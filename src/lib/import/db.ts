import { createServer } from '@/lib/supabase/utils';
import { Database } from '@/types/supabase';
import { MarketplaceName, NormalizedOrder } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

type OrderItem = Database['public']['Tables']['order_items']['Insert'];
type OrderFinancials = Database['public']['Tables']['order_financials']['Insert'];

/**
 * Salva os dados normalizados no banco de dados Supabase.
 * 
 * @param supabase Cliente Supabase (deve ser passado da Route Handler para garantir cookies corretos)
 * @param userId ID do usuário autenticado
 * @param marketplaceName Nome do marketplace detectado
 * @param normalizedData Dados normalizados dos pedidos
 * @param fileName Nome do arquivo importado
 * @param storeId ID da loja (ou 'temp-store-id' para criar automaticamente)
 */
export async function saveDataToDatabase(
  supabase: SupabaseClient<Database>,
  userId: string,
  marketplaceName: MarketplaceName,
  normalizedData: NormalizedOrder[],
  fileName: string,
  storeId: string
) {
  console.log('[saveDataToDatabase] Iniciando salvamento no banco de dados...');
  console.log('[saveDataToDatabase] userId:', userId);
  console.log('[saveDataToDatabase] marketplaceName:', marketplaceName);
  console.log('[saveDataToDatabase] normalizedData.length:', normalizedData.length);
  console.log('[saveDataToDatabase] storeId:', storeId);

  // Valida se a loja existe e pertence ao usuário
  // Se storeId for 'temp-store-id' ou inválido, cria uma loja padrão
  let finalStoreId = storeId;
  
  if (storeId === 'temp-store-id' || !storeId) {
    // Normaliza o nome do marketplace para buscar no banco
    const marketplaceNameMap: { [key: string]: string } = {
      'meli': 'meli',
      'mercadolivre': 'meli',
      'mercado livre': 'meli',
      'shopee': 'shopee',
      'shein': 'shein',
      'tiktok': 'tiktok',
      'tiktok shop': 'tiktok',
    };
    
    const normalizedMarketplaceName = marketplaceNameMap[marketplaceName.toLowerCase()] || marketplaceName.toLowerCase();
    
    // Busca ou cria uma loja padrão para o marketplace
    const { data: marketplace, error: marketplaceError } = await supabase
      .from('marketplaces')
      .select('id, name, display_name')
      .eq('name', normalizedMarketplaceName)
      .maybeSingle();
    
    if (marketplaceError) {
      console.error('Erro ao buscar marketplace:', marketplaceError);
      throw new Error(`Erro ao buscar marketplace: ${marketplaceError.message}`);
    }

    if (!marketplace) {
      console.error(`[saveDataToDatabase] Marketplace ${normalizedMarketplaceName} não encontrado.`);
      // Tenta buscar todos os marketplaces para debug
      const { data: allMarketplaces, error: allMpError } = await supabase
        .from('marketplaces')
        .select('id, name, display_name');
      
      if (allMpError) {
        console.error('[saveDataToDatabase] Erro ao buscar todos os marketplaces:', allMpError);
      } else {
        console.log('[saveDataToDatabase] Marketplaces disponíveis no banco:', allMarketplaces);
      }
      
      throw new Error(`Marketplace "${marketplaceName}" não encontrado. Verifique se o marketplace está cadastrado no banco de dados.`);
    }
    
    console.log(`[saveDataToDatabase] Marketplace encontrado: ${marketplace.name} (ID: ${marketplace.id})`);
    
    // Verifica se já existe uma loja para este marketplace e usuário
    const { data: existingStore, error: storeCheckError } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .eq('marketplace_id', marketplace.id)
      .limit(1)
      .maybeSingle();

    if (storeCheckError) {
      console.error('Erro ao verificar loja existente:', storeCheckError);
    }

    if (existingStore) {
      finalStoreId = existingStore.id;
      console.log(`Usando loja existente: ${finalStoreId}`);
    } else {
      // Cria uma nova loja
      const storeName = `Loja ${marketplace.display_name || marketplaceName}`;
      const { data: newStore, error: createError } = await supabase
        .from('stores')
        .insert({
          user_id: userId,
          marketplace_id: marketplace.id,
          name: storeName,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Erro ao criar loja:', createError);
        throw new Error(`Não foi possível criar loja para o marketplace ${marketplaceName}: ${createError.message}`);
      }
      
      if (!newStore) {
        throw new Error(`Não foi possível criar loja para o marketplace ${marketplaceName}: Loja não foi criada`);
      }
      
      finalStoreId = newStore.id;
      console.log(`Loja criada com sucesso: ${finalStoreId} (${storeName})`);
    }
  } else {
    // Valida se a loja existe e pertence ao usuário
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (storeError) {
      throw new Error(`Erro ao validar loja: ${storeError.message}`);
    }
    
    if (!store) {
      throw new Error('Loja não encontrada ou não pertence ao usuário.');
    }
    
    finalStoreId = storeId;
  }

  // 1. Criar um registro de importação
  console.log('[saveDataToDatabase] Criando registro de importação...');
  const { data: importRecord, error: importError } = await supabase
    .from('imports')
    .insert({
      user_id: userId,
      file_name: fileName,
      status: 'processing',
    })
    .select()
    .single();

  if (importError) {
    console.error('[saveDataToDatabase] Erro ao criar registro de importação:', {
      code: importError.code,
      message: importError.message,
      details: importError.details,
      hint: importError.hint,
    });
    throw new Error(`Não foi possível iniciar a importação: ${importError.message}`);
  }
  
  if (!importRecord) {
    console.error('[saveDataToDatabase] Registro de importação não foi criado (sem erro, mas sem dados)');
    throw new Error('Não foi possível iniciar a importação: registro não foi criado');
  }
  
  console.log('[saveDataToDatabase] Registro de importação criado com sucesso. ID:', importRecord.id);

  try {
    let insertedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // 2. Processar cada pedido normalizado
    console.log(`[saveDataToDatabase] Iniciando processamento de ${normalizedData.length} pedidos...`);
    
    for (let index = 0; index < normalizedData.length; index++) {
      const item = normalizedData[index];
      
      try {
        // Validação básica dos dados
        if (!item.platform_order_id) {
          errors.push(`Pedido na posição ${index + 1} não tem platform_order_id. Ignorando.`);
          console.warn(`[saveDataToDatabase] Pedido na posição ${index + 1} sem platform_order_id`);
          continue;
        }
        
        if (!item.order_date || !(item.order_date instanceof Date) || isNaN(item.order_date.getTime())) {
          errors.push(`Pedido ${item.platform_order_id} tem data inválida. Ignorando.`);
          console.warn(`[saveDataToDatabase] Pedido ${item.platform_order_id} com data inválida:`, item.order_date);
          continue;
        }
        
        // Verifica se já existe um pedido com o mesmo platform_order_id e store_id
        // Usa maybeSingle() para não lançar erro se não encontrar
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, order_date')
          .eq('store_id', finalStoreId)
          .eq('platform_order_id', item.platform_order_id)
          .maybeSingle();

        // Se já existe, pula este pedido (evita duplicação)
        if (existingOrder) {
          const existingDate = new Date(existingOrder.order_date).toISOString().split('T')[0];
          const newDate = new Date(item.order_date).toISOString().split('T')[0];
          console.log(`Pedido ${item.platform_order_id} já existe na loja (data existente: ${existingDate}, nova: ${newDate}). Ignorando.`);
          skippedCount++;
          continue;
        }

        // Verifica se existe pedido na mesma data (mesmo dia) com mesmo platform_order_id
        // Normaliza a data para comparar apenas o dia (sem hora)
        const orderDateOnly = new Date(item.order_date);
        orderDateOnly.setHours(0, 0, 0, 0);
        const orderDateEnd = new Date(item.order_date);
        orderDateEnd.setHours(23, 59, 59, 999);

        // Verifica se já existe pedido na mesma data com mesmo platform_order_id
        const { data: existingByDate } = await supabase
          .from('orders')
          .select('id')
          .eq('store_id', finalStoreId)
          .eq('platform_order_id', item.platform_order_id)
          .gte('order_date', orderDateOnly.toISOString())
          .lte('order_date', orderDateEnd.toISOString())
          .maybeSingle();

        if (existingByDate) {
          console.log(`Pedido ${item.platform_order_id} já existe na data ${orderDateOnly.toISOString().split('T')[0]}. Ignorando.`);
          skippedCount++;
          continue;
        }

        // 3. Inserir o pedido principal
        console.log(`[saveDataToDatabase] Tentando inserir pedido ${item.platform_order_id}...`);
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            store_id: finalStoreId,
            import_id: importRecord.id,
            platform_order_id: item.platform_order_id,
            order_date: item.order_date.toISOString(),
            settlement_date: item.settlement_date?.toISOString(),
          })
          .select('id')
          .single();

        if (orderError) {
          console.error(`[saveDataToDatabase] Erro ao inserir pedido ${item.platform_order_id}:`, {
            code: orderError.code,
            message: orderError.message,
            details: orderError.details,
            hint: orderError.hint,
          });
          
          // Se o erro for de duplicidade, ignora e continua
          if (orderError.code === '23505') {
            console.log(`Pedido ${item.platform_order_id} já existe (constraint). Ignorando.`);
            skippedCount++;
            continue;
          }
          
          // Se o erro for de RLS (Row Level Security)
          if (orderError.code === '42501' || orderError.message?.includes('permission') || orderError.message?.includes('policy')) {
            errors.push(`Erro de permissão ao inserir pedido ${item.platform_order_id}: ${orderError.message}. Verifique as políticas RLS.`);
            console.error(`[saveDataToDatabase] ERRO DE PERMISSÃO (RLS):`, orderError);
            continue;
          }
          
          // Para outros erros, adiciona à lista mas continua processando
          errors.push(`Erro ao inserir pedido ${item.platform_order_id}: ${orderError.message}`);
          continue;
        }
        
        if (!order || !order.id) {
          console.error(`[saveDataToDatabase] Pedido inserido mas sem ID retornado para ${item.platform_order_id}`);
          errors.push(`Erro: Pedido ${item.platform_order_id} foi inserido mas não retornou ID`);
          continue;
        }
        
        console.log(`[saveDataToDatabase] Pedido ${item.platform_order_id} inserido com sucesso. ID: ${order.id}`);

        // 4. Inserir os itens do pedido
        const orderItem: OrderItem = {
          order_id: order.id,
          sku: item.sku,
          quantity: item.quantity,
        };
        const { error: itemError } = await supabase.from('order_items').insert(orderItem);
        if (itemError) {
          console.error(`[saveDataToDatabase] Erro ao inserir item do pedido ${item.platform_order_id}:`, {
            code: itemError.code,
            message: itemError.message,
            details: itemError.details,
          });
          errors.push(`Erro ao inserir item do pedido ${item.platform_order_id}: ${itemError.message}`);
          // Continua mesmo com erro no item, mas não conta como inserido
          continue;
        }
        console.log(`[saveDataToDatabase] Item do pedido ${item.platform_order_id} inserido com sucesso`);

        // 5. Inserir os dados financeiros do pedido
        // Garante que order_value seja um número válido (obrigatório)
        const orderValue = typeof item.order_value === 'number' && !isNaN(item.order_value) 
          ? item.order_value 
          : (typeof item.revenue === 'number' && !isNaN(item.revenue) ? item.revenue : 0);
        
        const financials: OrderFinancials = {
          order_id: order.id,
          order_value: orderValue,
          revenue: typeof item.revenue === 'number' && !isNaN(item.revenue) ? item.revenue : orderValue,
          product_sales: typeof item.product_sales === 'number' && !isNaN(item.product_sales) ? item.product_sales : null,
          commissions: typeof item.commissions === 'number' && !isNaN(item.commissions) ? item.commissions : null,
          fees: typeof item.fees === 'number' && !isNaN(item.fees) ? item.fees : null,
          refunds: typeof item.refunds === 'number' && !isNaN(item.refunds) && item.refunds > 0 ? item.refunds : null,
          product_cost: typeof item.product_cost === 'number' && !isNaN(item.product_cost) ? item.product_cost : null,
          profit: typeof item.profit === 'number' && !isNaN(item.profit) ? item.profit : null,
          profit_margin: typeof item.profit_margin === 'number' && !isNaN(item.profit_margin) ? item.profit_margin : null,
        };
        const { error: financialsError } = await supabase.from('order_financials').insert(financials);
        if (financialsError) {
          console.error(`[saveDataToDatabase] Erro ao inserir dados financeiros do pedido ${item.platform_order_id}:`, {
            code: financialsError.code,
            message: financialsError.message,
            details: financialsError.details,
          });
          errors.push(`Erro ao inserir dados financeiros do pedido ${item.platform_order_id}: ${financialsError.message}`);
          // Continua mesmo com erro nos dados financeiros, mas não conta como inserido
          continue;
        }
        console.log(`[saveDataToDatabase] Dados financeiros do pedido ${item.platform_order_id} inseridos com sucesso`);

        insertedCount++;
        console.log(`[saveDataToDatabase] ✅ Pedido ${item.platform_order_id} completamente inserido. Total inserido: ${insertedCount}`);
      } catch (itemError: any) {
        // Captura erros individuais e continua processando
        errors.push(`Erro ao processar pedido ${item.platform_order_id}: ${itemError.message}`);
        console.error(`Erro ao processar item:`, itemError);
        continue;
      }
    }

    // 6. Atualizar o status da importação
    const hasErrors = errors.length > 0;
    const status = hasErrors && insertedCount === 0 ? 'failed' : 'success';
    
    await supabase
      .from('imports')
      .update({ 
        status,
        finished_at: new Date().toISOString(),
        error_details: hasErrors ? `Inseridos: ${insertedCount}, Ignorados: ${skippedCount}, Erros: ${errors.length}. ${errors.slice(0, 3).join('; ')}` : null
      })
      .eq('id', importRecord.id);

    console.log(`[saveDataToDatabase] ========== RESUMO DA IMPORTAÇÃO ==========`);
    console.log(`[saveDataToDatabase] Total processado: ${normalizedData.length}`);
    console.log(`[saveDataToDatabase] Inseridos: ${insertedCount}`);
    console.log(`[saveDataToDatabase] Ignorados (duplicados): ${skippedCount}`);
    console.log(`[saveDataToDatabase] Erros: ${errors.length}`);
    if (errors.length > 0) {
      console.log(`[saveDataToDatabase] Primeiros erros:`, errors.slice(0, 5));
    }
    console.log(`[saveDataToDatabase] ==========================================`);
    
    if (hasErrors && insertedCount === 0) {
      const errorSummary = errors.slice(0, 10).join('; ');
      throw new Error(`Nenhum pedido foi inserido. Erros: ${errorSummary}${errors.length > 10 ? '...' : ''}`);
    }

    return { 
      success: true,
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errors.length,
    };

  } catch (error: any) {
    // 7. Em caso de erro, atualizar o status da importação para falha
    console.error('[saveDataToDatabase] ========== ERRO CRÍTICO ==========');
    console.error('[saveDataToDatabase] Erro durante a inserção no banco de dados:', error);
    console.error('[saveDataToDatabase] Mensagem:', error?.message);
    console.error('[saveDataToDatabase] Stack:', error?.stack);
    console.error('[saveDataToDatabase] ====================================');
    
    // Tenta atualizar o status mesmo em caso de erro
    try {
      await supabase
        .from('imports')
        .update({
          status: 'failed',
          error_details: error?.message || 'Erro desconhecido',
          finished_at: new Date().toISOString(),
        })
        .eq('id', importRecord.id);
    } catch (updateError) {
      console.error('[saveDataToDatabase] Erro ao atualizar status da importação:', updateError);
    }
    
    throw error;
  }
}
