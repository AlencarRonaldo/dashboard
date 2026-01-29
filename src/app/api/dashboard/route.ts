import { createServerFromRequest } from '@/lib/supabase/utils';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { supabase, response } = createServerFromRequest(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // 1. Busca todas as lojas do usuário
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', userId);

    if (storesError) throw storesError;

    const storeIds = (stores || []).map((s) => s.id);
    if (storeIds.length === 0) {
      // Se não tem lojas, retorna dados vazios
      return NextResponse.json({
        kpis: {
          totalRevenue: 0,
          netRevenue: 0,
          totalProfit: 0,
          averageMargin: 0,
          totalOrders: 0,
          averageTicket: 0,
        },
        marketplaceStats: [],
        revenueData: [],
        marketplaceData: [],
        marginData: [],
        orders: [],
      });
    }

    // 2. Busca todos os pedidos do usuário
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, platform_order_id, order_date, settlement_date, store_id')
      .in('store_id', storeIds)
      .order('order_date', { ascending: false });

    if (ordersError) throw ordersError;

    // 3. Busca dados das lojas e marketplaces
    let storeMap = new Map();
    
    try {
      const { data: storesWithMarketplaces, error: storesMarketplaceError } = await supabase
        .from('stores')
        .select('id, name, marketplace_id, marketplaces:marketplace_id(name, display_name)')
        .in('id', storeIds);
      
      if (storesMarketplaceError) {
        console.warn('[Dashboard API] Erro ao buscar lojas com marketplaces (tentando método alternativo):', storesMarketplaceError);
        // Tenta buscar sem o join
        const { data: storesOnly } = await supabase
          .from('stores')
          .select('id, name, marketplace_id')
          .in('id', storeIds);
        
        if (storesOnly && storesOnly.length > 0) {
          // Busca marketplaces separadamente
          const marketplaceIds = [...new Set(storesOnly.map((s: any) => s.marketplace_id).filter(Boolean))];
          const { data: marketplaces } = marketplaceIds.length > 0
            ? await supabase
                .from('marketplaces')
                .select('id, name, display_name')
                .in('id', marketplaceIds)
            : { data: [] };
          
          const marketplaceMap = new Map((marketplaces || []).map((m: any) => [m.id, m]));
          
          storeMap = new Map(
            (storesOnly || []).map((s: any) => {
              const mp = marketplaceMap.get(s.marketplace_id);
              return [
                s.id,
                {
                  name: s.name || 'Loja Desconhecida',
                  marketplace: mp?.display_name || 'Desconhecido',
                  marketplaceName: mp?.name || 'unknown',
                },
              ];
            })
          );
        }
      } else {
        storeMap = new Map(
          (storesWithMarketplaces || []).map((s: any) => [
            s.id,
            {
              name: s.name || 'Loja Desconhecida',
              marketplace: s.marketplaces?.display_name || 'Desconhecido',
              marketplaceName: s.marketplaces?.name || 'unknown',
            },
          ])
        );
      }
    } catch (storeError: any) {
      console.error('[Dashboard API] Erro ao processar lojas:', storeError);
      // Continua com storeMap vazio, será preenchido com valores padrão durante o processamento
    }

    // 4. Busca dados financeiros (em lotes para evitar overflow)
    const orderIds = (orders || []).map((o: any) => o.id);
    console.log('[Dashboard API] Total de pedidos encontrados:', orders?.length || 0);
    console.log('[Dashboard API] IDs dos pedidos:', orderIds.slice(0, 5), '...');
    
    const financialsMap = new Map();
    const BATCH_SIZE = 100; // Processa em lotes de 100 para evitar overflow
    
    if (orderIds.length > 0) {
      try {
        // Processa em lotes
        for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
          const batch = orderIds.slice(i, i + BATCH_SIZE);
          const { data: batchFinancials, error: batchError } = await supabase
            .from('order_financials')
            .select('order_id, order_value, revenue, product_sales, commissions, total_fees, transaction_fee, shipping_fee, other_platform_fees, shipping_fee_buyer, platform_discount, refunds, product_cost, profit, profit_margin')
            .in('order_id', batch);
          
          // Log dos primeiros registros financeiros para debug
          if (i === 0 && batchFinancials && batchFinancials.length > 0) {
            console.log('[Dashboard API] Exemplo de dados financeiros do banco:', batchFinancials[0]);
          }
          
          if (batchError) {
            console.error(`[Dashboard API] Erro ao buscar dados financeiros (lote ${i / BATCH_SIZE + 1}):`, batchError);
            // Continua mesmo com erro
          } else if (batchFinancials) {
            batchFinancials.forEach((f: any) => {
              financialsMap.set(f.order_id, f);
            });
          }
        }
      } catch (error: any) {
        console.error('[Dashboard API] Erro ao buscar dados financeiros:', error);
        // Continua mesmo com erro, usando mapa vazio
      }
    }
    
    console.log('[Dashboard API] Total de registros financeiros encontrados:', financialsMap.size);
    if (financialsMap.size > 0) {
      const firstFinancial = Array.from(financialsMap.values())[0];
      console.log('[Dashboard API] Exemplo de dados financeiros:', firstFinancial);
    } else {
      console.warn('[Dashboard API] ⚠️ NENHUM dado financeiro encontrado!');
      console.warn('[Dashboard API] Isso pode significar que:');
      console.warn('[Dashboard API] 1. Os dados financeiros não foram salvos durante a importação');
      console.warn('[Dashboard API] 2. Os pedidos foram importados antes das correções');
      console.warn('[Dashboard API] 3. Pode ser necessário reimportar os arquivos');
      
      // Verifica se há algum registro financeiro no banco (para debug)
      try {
        const { count } = await supabase
          .from('order_financials')
          .select('*', { count: 'exact', head: true });
        console.log('[Dashboard API] Total de registros financeiros no banco (todos os usuários):', count || 0);
      } catch (countError) {
        console.warn('[Dashboard API] Não foi possível contar registros financeiros:', countError);
      }
    }
    
    console.log('[Dashboard API] Mapa de dados financeiros criado com', financialsMap.size, 'entradas');

    // 5. Busca itens dos pedidos
    const { data: items } = orderIds.length > 0
      ? await supabase
          .from('order_items')
          .select('order_id, sku, quantity')
          .in('order_id', orderIds)
      : { data: [] };

    const itemsMap = new Map<string, any[]>();
    (items || []).forEach((item: any) => {
      const existing = itemsMap.get(item.order_id) || [];
      existing.push(item);
      itemsMap.set(item.order_id, existing);
    });

    // 6. Processa os dados para KPIs
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalOrders = 0;
    let totalOrderValue = 0;
    let totalFees = 0; // Total de taxas (fees + commissions)
    let totalCommissions = 0;

    const ordersProcessed = (orders || []).map((order: any, index: number) => {
      // Validação de segurança: garante que order tem os campos necessários
      if (!order || !order.id) {
        console.warn(`[Dashboard API] ⚠️ Pedido inválido no índice ${index}:`, order);
        return null;
      }
      
      try {
        const financials = financialsMap.get(order.id) || {};
        const storeInfo = storeMap.get(order.store_id) || {
          name: 'Desconhecida',
          marketplace: 'Desconhecido',
          marketplaceName: 'unknown',
        };
        const orderItems = itemsMap.get(order.id) || [];

      // Faturamento = valor do pedido (o que o cliente pagou)
      const orderValue = Number(financials.order_value || financials.revenue || 0);
      // Comissões e taxas (para exibição)
      const commissions = Number(financials.commissions || 0);
      const fees = Number(financials.total_fees || 0);

      // Lucro = usar o valor salvo no banco (da planilha original)
      const profit = Number(financials.profit || 0);

      // Faturamento para display = order_value
      const revenue = orderValue;

      // Margem = lucro / faturamento
      let margin = 0;
      if (revenue > 0) {
        margin = Math.max(-100, Math.min(100, (profit / revenue) * 100));
      }

      totalRevenue += revenue;
      totalProfit += profit;
      totalOrderValue += orderValue;
      totalOrders += 1;
      totalFees += fees;
      totalCommissions += commissions;

      // Formata a data para string ISO (YYYY-MM-DD)
      let orderDate = '';
      try {
        if (order.order_date) {
          const date = new Date(order.order_date);
          if (!isNaN(date.getTime())) {
            orderDate = date.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn(`[Dashboard API] Erro ao formatar data do pedido ${order.platform_order_id}:`, e);
      }

      let settlementDate = null;
      try {
        if (order.settlement_date) {
          const date = new Date(order.settlement_date);
          if (!isNaN(date.getTime())) {
            settlementDate = date.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn(`[Dashboard API] Erro ao formatar settlement_date do pedido ${order.platform_order_id}:`, e);
      }

        return {
          id: order.id,
          platform_order_id: order.platform_order_id || 'N/A',
          date: orderDate,
          settlement_date: settlementDate,
          marketplace: storeInfo.marketplace,
          marketplaceName: storeInfo.marketplaceName,
          store: storeInfo.name,
          sku: orderItems[0]?.sku || 'N/A',
          quantity: orderItems[0]?.quantity || 1,
          revenue,
          profit,
          margin,
          order_value: orderValue,
          total_fees: fees,
          commissions: commissions,
          totalFees: fees + commissions, // Total de taxas (fees + commissions)
        };
      } catch (error: any) {
        console.error(`[Dashboard API] Erro ao processar pedido ${order?.id || index}:`, error);
        return null;
      }
    }).filter((order): order is NonNullable<typeof order> => order !== null); // Remove pedidos inválidos

    const finalTotalProfit = totalProfit;
    const grossRevenue = totalRevenue;
    let averageMargin = 0;
    if (totalRevenue > 0) {
      averageMargin = Math.max(-100, Math.min(100, (finalTotalProfit / totalRevenue) * 100));
    }
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    console.log('[Dashboard API] KPIs:', {
      pedidos: totalOrders,
      faturamento: totalRevenue,
      lucro: finalTotalProfit,
      margem: averageMargin,
      ticket: averageTicket,
    });

    // 7. Agrupa por marketplace
    const marketplaceMap = new Map<string, {
      marketplace: string;
      marketplaceName: string;
      revenue: number;
      profit: number;
      orders: number;
      margin: number;
      totalFees: number; // Total de taxas (fees + commissions)
    }>();

    ordersProcessed.forEach((order) => {
      const key = order.marketplaceName || 'unknown';
      const existing = marketplaceMap.get(key) || {
        marketplace: order.marketplace || 'Desconhecido',
        marketplaceName: order.marketplaceName || 'unknown',
        revenue: 0,
        profit: 0,
        orders: 0,
        margin: 0,
        totalFees: 0,
      };

      existing.revenue += order.revenue;
      existing.profit += order.profit;
      existing.orders += 1;
      existing.totalFees += (order.totalFees || 0);
      marketplaceMap.set(key, existing);
    });

    const marketplaceStats = Array.from(marketplaceMap.values()).map((stats) => {
      let margin = 0;
      if (stats.revenue > 0) {
        margin = Math.max(-100, Math.min(100, (stats.profit / stats.revenue) * 100));
      }
      return {
        ...stats,
        margin,
        trend: { value: 0, isPositive: true },
      };
    });

    // 8. Dados para gráfico de receita por período
    const revenueByDate = new Map<string, { revenue: number; profit: number }>();

    ordersProcessed.forEach((order) => {
      if (!order.date) return; // Ignora pedidos sem data válida
      try {
        const date = new Date(order.date);
        if (isNaN(date.getTime())) return; // Ignora datas inválidas
        const dateKey = date.toISOString().split('T')[0];
        const existing = revenueByDate.get(dateKey) || { revenue: 0, profit: 0 };
        existing.revenue += order.revenue;
        existing.profit += order.profit;
        revenueByDate.set(dateKey, existing);
      } catch (e) {
        console.warn(`[Dashboard API] Erro ao processar data do pedido ${order.platform_order_id}:`, e);
      }
    });

    const revenueData = Array.from(revenueByDate.entries())
      .map(([date, data]) => ({ date, revenue: data.revenue, profit: data.profit }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 9. Dados para gráfico de marketplace
    const marketplaceData = marketplaceStats.map((stats) => ({
      marketplace: stats.marketplace,
      revenue: stats.revenue,
      profit: stats.profit,
    }));

    // 10. Dados para gráfico de margem por loja
    const marginByStore = new Map<string, { margin: number; count: number }>();

    ordersProcessed.forEach((order) => {
      const storeKey = order.store;
      const existing = marginByStore.get(storeKey) || { margin: 0, count: 0 };
      existing.margin += order.margin || 0;
      existing.count += 1;
      marginByStore.set(storeKey, existing);
    });

    const marginData = Array.from(marginByStore.entries()).map(([store, data]) => ({
      store,
      margin: data.count > 0 ? data.margin / data.count : 0,
    }));

    const finalResponse = NextResponse.json(
      {
        kpis: {
          totalRevenue,
          netRevenue: grossRevenue,
          totalProfit: finalTotalProfit,
          averageMargin,
          totalOrders,
          averageTicket,
          totalFees: totalFees + totalCommissions, // Total de taxas (fees + commissions)
        },
        marketplaceStats,
        revenueData,
        marketplaceData,
        marginData,
        orders: (ordersProcessed || []).slice(0, 100), // Limita a 100 pedidos mais recentes
      },
      { status: 200 }
    );

    // Copia os cookies da resposta do Supabase
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return finalResponse;
  } catch (error: any) {
    console.error('[Dashboard API] ========== ERRO CRÍTICO ==========');
    console.error('[Dashboard API] Erro:', error);
    console.error('[Dashboard API] Stack:', error?.stack);
    console.error('[Dashboard API] Mensagem:', error?.message);
    console.error('[Dashboard API] Nome:', error?.name);
    console.error('[Dashboard API] Código:', error?.code);
    if (error?.details) {
      console.error('[Dashboard API] Detalhes:', error.details);
    }
    console.error('[Dashboard API] ====================================');
    
    const errorMessage = error?.message || error?.toString() || 'Internal Server Error';
    
    const finalResponse = NextResponse.json(
      { 
        error: errorMessage,
        kpis: {
          totalRevenue: 0,
          netRevenue: 0,
          totalProfit: 0,
          averageMargin: 0,
          totalOrders: 0,
          averageTicket: 0,
        },
        marketplaceStats: [],
        revenueData: [],
        marketplaceData: [],
        marginData: [],
        orders: [],
      },
      { status: 500 }
    );
    
    // Copia os cookies mesmo em caso de erro
    try {
      response.cookies.getAll().forEach((cookie) => {
        finalResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
    } catch (cookieError) {
      console.warn('[Dashboard API] Erro ao copiar cookies:', cookieError);
    }
    
    return finalResponse;
  }
}
