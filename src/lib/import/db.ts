import { createServer } from '@/lib/supabase/server';
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

    // 2. Remove duplicatas em memória ANTES de processar (evita queries desnecessárias)
    const seenOrderIds = new Set<string>();
    const uniqueOrders = normalizedData.filter((item) => {
      if (!item.platform_order_id) return false;
      const key = `${item.platform_order_id}_${finalStoreId}`;
      if (seenOrderIds.has(key)) {
        console.log(`[saveDataToDatabase] Duplicata em memória ignorada: ${item.platform_order_id}`);
        return false;
      }
      seenOrderIds.add(key);
      return true;
    });

    console.log(
      `[saveDataToDatabase] Iniciando processamento: ${normalizedData.length} pedidos totais, ${uniqueOrders.length} únicos após remoção de duplicatas em memória.`
    );

    // 3. Busca TODOS os pedidos existentes de uma vez (otimização)
    const { data: existingOrdersData } = await supabase
      .from('orders')
      .select('platform_order_id, order_date')
      .eq('store_id', finalStoreId);

    const existingOrdersSet = new Set(
      (existingOrdersData || []).map((o) => `${o.platform_order_id}_${finalStoreId}`)
    );

    console.log(
      `[saveDataToDatabase] Encontrados ${existingOrdersSet.size} pedidos já existentes no banco para esta loja.`
    );

    // 4. Processar cada pedido normalizado (apenas os únicos)
    for (let index = 0; index < uniqueOrders.length; index++) {
      const item = uniqueOrders[index];

      // Log de progresso a cada 50 pedidos
      if ((index + 1) % 50 === 0 || index === 0) {
        console.log(
          `[saveDataToDatabase] Progresso: ${index + 1}/${uniqueOrders.length} (${Math.round(((index + 1) / uniqueOrders.length) * 100)}%)`
        );
      }

      try {
        // Validação básica dos dados
        if (!item.platform_order_id) {
          errors.push(`Pedido na posição ${index + 1} não tem platform_order_id. Ignorando.`);
          console.warn(`[saveDataToDatabase] Pedido na posição ${index + 1} sem platform_order_id`);
          skippedCount++;
          continue;
        }

        if (!item.order_date || !(item.order_date instanceof Date) || isNaN(item.order_date.getTime())) {
          errors.push(`Pedido ${item.platform_order_id} tem data inválida. Ignorando.`);
          console.warn(`[saveDataToDatabase] Pedido ${item.platform_order_id} com data inválida:`, item.order_date);
          skippedCount++;
          continue;
        }

        // Verificação rápida em memória (já carregamos todos os existentes)
        const orderKey = `${item.platform_order_id}_${finalStoreId}`;
        if (existingOrdersSet.has(orderKey)) {
          console.log(
            `[saveDataToDatabase] Pedido ${item.platform_order_id} já existe no banco. Ignorando.`
          );
          skippedCount++;
          continue;
        }

        // 3. Inserir o pedido principal
        // Log apenas a cada 10 pedidos para não poluir o console
        if (insertedCount % 10 === 0) {
          console.log(`[saveDataToDatabase] Processando pedido ${index + 1}/${uniqueOrders.length}: ${item.platform_order_id}...`);
        }
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
            console.log(`Pedido ${item.platform_order_id} já existe (constraint UNIQUE). Ignorando.`);
            // Adiciona ao Set para evitar reprocessamento
            existingOrdersSet.add(orderKey);
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
        
        // Adiciona ao Set em memória para evitar reprocessamento
        existingOrdersSet.add(orderKey);

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

        // 5. Inserir os dados financeiros do pedido
        // Garante que order_value seja um número válido (obrigatório)
        const orderValue = typeof item.order_value === 'number' && !isNaN(item.order_value) && item.order_value > 0
          ? item.order_value 
          : (typeof item.revenue === 'number' && !isNaN(item.revenue) && item.revenue > 0 ? item.revenue : 0);
        
        // Calcula revenue - prioriza item.revenue, depois product_sales, depois order_value
        let revenue = 0;
        if (typeof item.revenue === 'number' && !isNaN(item.revenue) && item.revenue > 0) {
          revenue = item.revenue;
        } else if (typeof item.product_sales === 'number' && !isNaN(item.product_sales) && item.product_sales > 0) {
          revenue = item.product_sales;
        } else if (orderValue > 0) {
          revenue = orderValue;
        }
        
        // Calcula custos e taxas para validação
        const productCost = typeof item.product_cost === 'number' && !isNaN(item.product_cost) ? item.product_cost : 0;
        // Comissões podem vir como negativas (descontos), então usa valor absoluto
        const commissions = typeof item.commissions === 'number' && !isNaN(item.commissions) ? Math.abs(item.commissions) : 0;
        const fees = typeof item.fees === 'number' && !isNaN(item.fees) ? item.fees : 0;
        const refunds = typeof item.refunds === 'number' && !isNaN(item.refunds) && item.refunds > 0 ? item.refunds : 0;
        
        // Calcula o lucro correto baseado nos custos
        // Lucro = Receita - Custo do Produto - Comissões (absoluto) - Taxas - Reembolsos
        const calculatedProfit = revenue > 0 
          ? revenue - productCost - commissions - fees - refunds 
          : 0;
        
        // Calcula profit - valida se o valor do item está consistente
        let profit = null;
        if (typeof item.profit === 'number' && !isNaN(item.profit)) {
          // Valida: lucro não pode ser maior que receita
          if (item.profit > revenue && revenue > 0) {
            console.warn(`[saveDataToDatabase] ⚠️ Lucro inconsistente para pedido ${item.platform_order_id}: lucro=${item.profit}, receita=${revenue}. Recalculando...`);
            profit = calculatedProfit;
          } else if (revenue > 0 && Math.abs(item.profit - calculatedProfit) > revenue * 0.05) {
            // Se a diferença for maior que 5% da receita, recalcula
            console.warn(`[saveDataToDatabase] ⚠️ Lucro muito diferente do calculado para pedido ${item.platform_order_id}: lucro=${item.profit}, calculado=${calculatedProfit}. Usando calculado.`);
            profit = calculatedProfit;
          } else {
            // Lucro parece válido
            profit = item.profit;
          }
        } else if (revenue > 0) {
          // Não tem lucro no item, calcula
          profit = calculatedProfit;
        }
        
        // Garantia final: lucro nunca pode ser maior que receita
        if (profit !== null && profit > revenue && revenue > 0) {
          console.warn(`[saveDataToDatabase] ⚠️ Correção final: lucro (${profit}) > receita (${revenue}) para pedido ${item.platform_order_id}. Ajustando...`);
          profit = calculatedProfit;
        }
        
        // Calcula profit_margin se não estiver presente
        let profitMargin = null;
        if (typeof item.profit_margin === 'number' && !isNaN(item.profit_margin)) {
          // Valida margem: não pode ser maior que 100%
          if (item.profit_margin > 100 && revenue > 0) {
            console.warn(`[saveDataToDatabase] ⚠️ Margem inválida (${item.profit_margin}%) para pedido ${item.platform_order_id}. Recalculando...`);
            profitMargin = revenue > 0 && profit !== null ? (profit / revenue) * 100 : 0;
          } else {
            profitMargin = item.profit_margin;
          }
        } else if (revenue > 0 && profit !== null && profit !== undefined) {
          profitMargin = (profit / revenue) * 100;
          // Limita margem a 100%
          if (profitMargin > 100) {
            profitMargin = 100;
          }
        }
        
        const financials: OrderFinancials = {
          order_id: order.id,
          order_value: orderValue > 0 ? orderValue : revenue,
          revenue: revenue > 0 ? revenue : (orderValue > 0 ? orderValue : 0),
          product_sales: typeof item.product_sales === 'number' && !isNaN(item.product_sales) ? item.product_sales : null,
          // Salva comissões como valor absoluto (sempre positivo no banco)
          commissions: typeof item.commissions === 'number' && !isNaN(item.commissions) ? Math.abs(item.commissions) : null,
          fees: typeof item.fees === 'number' && !isNaN(item.fees) ? item.fees : null,
          refunds: typeof item.refunds === 'number' && !isNaN(item.refunds) && item.refunds > 0 ? item.refunds : null,
          product_cost: typeof item.product_cost === 'number' && !isNaN(item.product_cost) ? item.product_cost : null,
          profit: profit,
          profit_margin: profitMargin,
        };
        
        // Log dos primeiros 5 pedidos para debug
        if (insertedCount < 5) {
          console.log(`[saveDataToDatabase] Pedido ${item.platform_order_id} - Dados financeiros a serem salvos:`, {
            revenue: financials.revenue,
            product_cost: financials.product_cost,
            commissions: financials.commissions,
            fees: financials.fees,
            refunds: financials.refunds,
            profit: financials.profit,
            profit_margin: financials.profit_margin,
            order_value: financials.order_value
          });
        }
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

        insertedCount++;
        // Log apenas a cada 10 inserções ou no final
        if (insertedCount % 10 === 0 || index === uniqueOrders.length - 1) {
          console.log(`[saveDataToDatabase] ✅ Progresso: ${insertedCount} pedidos inseridos, ${skippedCount} ignorados`);
        }
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
