import { createServer } from '@/lib/supabase/utils';
import { Database } from '@/types/supabase';
import { MarketplaceName, NormalizedOrder } from './types';

type OrderItem = Database['public']['Tables']['order_items']['Insert'];
type OrderFinancials = Database['public']['Tables']['order_financials']['Insert'];

/**
 * Salva os dados normalizados no banco de dados Supabase.
 */
export async function saveDataToDatabase(
  userId: string,
  marketplaceName: MarketplaceName,
  normalizedData: NormalizedOrder[],
  fileName: string,
  storeId: string
) {
  const supabase = createServer();

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
      console.error(`Marketplace ${normalizedMarketplaceName} não encontrado.`);
      // Tenta buscar todos os marketplaces para debug
      const { data: allMarketplaces } = await supabase
        .from('marketplaces')
        .select('name');
      console.log('Marketplaces disponíveis:', allMarketplaces);
      throw new Error(`Marketplace "${marketplaceName}" não encontrado. Verifique se o marketplace está cadastrado no banco de dados.`);
    }
    
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
  const { data: importRecord, error: importError } = await supabase
    .from('imports')
    .insert({
      user_id: userId,
      file_name: fileName,
      status: 'processing',
    })
    .select()
    .single();

  if (importError || !importRecord) {
    console.error('Erro ao criar registro de importação:', importError);
    throw new Error('Não foi possível iniciar a importação.');
  }

  try {
    let insertedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // 2. Processar cada pedido normalizado
    for (const item of normalizedData) {
      try {
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
          // Se o erro for de duplicidade, ignora e continua
          if (orderError.code === '23505') {
            console.log(`Pedido ${item.platform_order_id} já existe (constraint). Ignorando.`);
            skippedCount++;
            continue;
          }
          // Para outros erros, adiciona à lista mas continua processando
          errors.push(`Erro ao inserir pedido ${item.platform_order_id}: ${orderError.message}`);
          console.error(`Erro ao inserir pedido ${item.platform_order_id}:`, orderError);
          continue;
        }

        if (order) {
          // 4. Inserir os itens do pedido
          const orderItem: OrderItem = {
            order_id: order.id,
            sku: item.sku,
            quantity: item.quantity,
          };
          const { error: itemError } = await supabase.from('order_items').insert(orderItem);
          if (itemError) {
            errors.push(`Erro ao inserir item do pedido ${item.platform_order_id}: ${itemError.message}`);
            console.error(`Erro ao inserir item:`, itemError);
            // Continua mesmo com erro no item
            continue;
          }

          // 5. Inserir os dados financeiros do pedido
          const financials: OrderFinancials = {
            order_id: order.id,
            order_value: item.order_value,
            revenue: item.revenue,
            product_sales: item.product_sales,
            commissions: item.commissions,
            fees: item.fees,
            refunds: item.refunds,
            product_cost: item.product_cost,
            profit: item.profit,
            profit_margin: item.profit_margin,
          };
          const { error: financialsError } = await supabase.from('order_financials').insert(financials);
          if (financialsError) {
            errors.push(`Erro ao inserir dados financeiros do pedido ${item.platform_order_id}: ${financialsError.message}`);
            console.error(`Erro ao inserir dados financeiros:`, financialsError);
            // Continua mesmo com erro nos dados financeiros
            continue;
          }

          insertedCount++;
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

    console.log(`Importação concluída: ${insertedCount} inseridos, ${skippedCount} ignorados, ${errors.length} erros`);
    
    if (hasErrors && insertedCount === 0) {
      throw new Error(`Nenhum pedido foi inserido. Erros: ${errors.join('; ')}`);
    }

    return { 
      success: true,
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errors.length,
    };

  } catch (error: any) {
    // 7. Em caso de erro, atualizar o status da importação para falha
    console.error('Erro durante a inserção no banco de dados:', error);
    await supabase
      .from('imports')
      .update({
        status: 'failed',
        error_details: error.message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);
    throw error;
  }
}
