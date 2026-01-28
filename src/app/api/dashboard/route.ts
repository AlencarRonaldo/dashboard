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
            .select('order_id, order_value, revenue, product_sales, commissions, fees, refunds, product_cost, profit, profit_margin')
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

      // Tenta obter revenue de várias fontes possíveis
      let revenue = 0;
      if (financials.revenue != null && financials.revenue !== undefined) {
        revenue = Number(financials.revenue);
      } else if (financials.order_value != null && financials.order_value !== undefined) {
        revenue = Number(financials.order_value);
      } else if (financials.product_sales != null && financials.product_sales !== undefined) {
        revenue = Number(financials.product_sales);
      }
      
      // Obtém custos e taxas para recalcular lucro se necessário
      // IMPORTANTE: Verifica se os valores são null, undefined, ou NaN
      const productCost = (financials.product_cost != null && financials.product_cost !== undefined && !isNaN(Number(financials.product_cost)))
        ? Number(financials.product_cost) 
        : 0;
      const commissions = (financials.commissions != null && financials.commissions !== undefined && !isNaN(Number(financials.commissions)))
        ? Number(financials.commissions) 
        : 0;
      const fees = (financials.fees != null && financials.fees !== undefined && !isNaN(Number(financials.fees)))
        ? Number(financials.fees) 
        : 0;
      const refunds = (financials.refunds != null && financials.refunds !== undefined && !isNaN(Number(financials.refunds)) && Number(financials.refunds) > 0)
        ? Number(financials.refunds) 
        : 0;
      
      // Calcula o lucro correto: Receita - Custo do Produto - Comissões - Taxas - Reembolsos
      const calculatedProfit = revenue > 0 
        ? revenue - productCost - commissions - fees - refunds 
        : 0;
      
      // Obtém lucro do banco
      const profitFromDb = financials.profit != null && financials.profit !== undefined 
        ? Number(financials.profit) 
        : null;
      
      // SEMPRE usa o lucro calculado se tivermos dados de custos/taxas disponíveis
      // Isso garante que as taxas sejam sempre descontadas corretamente
      let profit = calculatedProfit;
      const hasCostData = productCost > 0 || commissions > 0 || fees > 0 || refunds > 0;
      
      // DETECÇÃO CRÍTICA: Se lucro = receita (do banco OU calculado), significa que taxas não foram descontadas
      const profitFromDbEqualsRevenue = profitFromDb !== null && revenue > 0 && Math.abs(profitFromDb - revenue) < 0.01;
      const calculatedProfitEqualsRevenue = revenue > 0 && Math.abs(calculatedProfit - revenue) < 0.01;
      const profitEqualsRevenue = profitFromDbEqualsRevenue || (profitFromDb === null && calculatedProfitEqualsRevenue);
      
      if (index < 5) {
        console.log(`[Dashboard API] Pedido ${order.platform_order_id}:`, {
          receita,
          lucroBanco: profitFromDb,
          lucroCalculado: calculatedProfit,
          temCustos: hasCostData,
          custoProduto: productCost,
          comissoes: commissions,
          taxas: fees,
          reembolsos: refunds,
          lucroIgualReceita: profitEqualsRevenue,
          profitFromDbEqualsRevenue,
          calculatedProfitEqualsRevenue
        });
      }
      
      // PRIORIDADE 1: Se lucro = receita (qualquer que seja a origem), SEMPRE aplica estimativa de taxas
      if (profitEqualsRevenue && revenue > 0) {
        console.warn(`[Dashboard API] ⚠️ Lucro igual à receita (${profitFromDb || calculatedProfit}) para pedido ${order.platform_order_id}. Taxas não descontadas. Aplicando estimativa...`);
        // Estima uma margem conservadora baseada no marketplace
        // Mercado Livre: ~12-15% de taxas, Shopee: ~10-12%, Shein: ~8-10%, TikTok: ~10-12%
        const marketplaceName = storeInfo?.marketplaceName || 'unknown';
        const marketplaceFeeRate = marketplaceName === 'meli' ? 0.13 : 
                                   marketplaceName === 'shopee' ? 0.11 :
                                   marketplaceName === 'shein' ? 0.09 :
                                   0.11; // padrão
        const estimatedFees = revenue * marketplaceFeeRate;
        profit = revenue - estimatedFees;
        console.warn(`[Dashboard API] Lucro estimado (${(marketplaceFeeRate * 100).toFixed(1)}% de taxas estimadas): ${profit.toFixed(2)}`);
      } else if (profitFromDb !== null && !hasCostData) {
        // Se lucro do banco é maior que receita, SEMPRE recalcula
        if (profitFromDb > revenue && revenue > 0) {
          if (index < 10) {
            console.warn(`[Dashboard API] ⚠️ Lucro do banco (${profitFromDb}) > receita (${revenue}) para pedido ${order.platform_order_id}. Recalculando...`);
          }
          profit = calculatedProfit;
        } 
        // Se a diferença for significativa (mais de 5% da receita), recalcula
        else if (revenue > 0 && Math.abs(profitFromDb - calculatedProfit) > Math.abs(revenue * 0.05)) {
          if (index < 10) {
            console.warn(`[Dashboard API] ⚠️ Diferença significativa para pedido ${order.platform_order_id}:`, {
              lucroBanco: profitFromDb,
              receita: revenue,
              lucroCalculado: calculatedProfit,
              diferenca: Math.abs(profitFromDb - calculatedProfit),
              acao: 'Recalculando com base nos custos'
            });
          }
          profit = calculatedProfit;
        } 
        // Lucro do banco parece válido e não temos dados de custos
        else {
          profit = profitFromDb;
        }
      } else if (hasCostData) {
        // Se temos dados de custos, SEMPRE usa o calculado para garantir que taxas sejam descontadas
        if (index < 5 && profitFromDb !== null && Math.abs(profitFromDb - calculatedProfit) > 0.01) {
          console.log(`[Dashboard API] Usando lucro calculado (${calculatedProfit}) em vez do banco (${profitFromDb}) para pedido ${order.platform_order_id} - taxas descontadas:`, {
            receita: revenue,
            custoProduto: productCost,
            comissoes: commissions,
            taxas: fees,
            reembolsos: refunds,
            lucroCalculado: calculatedProfit
          });
        }
        profit = calculatedProfit;
      }
      
      // GARANTIA FINAL ABSOLUTA: lucro nunca pode ser maior que receita
      // Se ainda assim estiver maior, limita ao máximo possível (receita)
      if (profit > revenue && revenue > 0) {
        console.warn(`[Dashboard API] ⚠️⚠️ CORREÇÃO CRÍTICA: lucro (${profit}) > receita (${revenue}) para pedido ${order.platform_order_id}.`, {
          lucroOriginal: profit,
          receita: revenue,
          lucroCalculado: calculatedProfit,
          custoProduto: productCost,
          comissoes: commissions,
          taxas: fees,
          reembolsos: refunds,
          acao: 'Limitando lucro à receita'
        });
        // Se o calculado também estiver errado, limita à receita
        if (calculatedProfit > revenue) {
          profit = revenue;
        } else {
          profit = calculatedProfit;
        }
      }
      
      // Garantia adicional: se o lucro calculado também estiver errado, usa 0 ou receita mínima
      if (profit > revenue && revenue > 0) {
        console.error(`[Dashboard API] ❌ ERRO CRÍTICO: Mesmo após recálculo, lucro (${profit}) > receita (${revenue}). Limitando a 0.`);
        profit = 0;
      }
      
      const orderValue = financials.order_value != null && financials.order_value !== undefined
        ? Number(financials.order_value)
        : revenue;
      
      // Calcula margem, garantindo que não seja maior que 100%
      let margin = 0;
      if (revenue > 0 && profit !== undefined) {
        margin = (profit / revenue) * 100;
        // Limita margem a 100% (caso extremo onde custos são negativos ou há erro)
        if (margin > 100) {
          console.warn(`[Dashboard API] ⚠️ Margem inválida (${margin}%) para pedido ${order.platform_order_id}. Ajustando para 100%`);
          margin = 100;
        }
        // Permite margem negativa (prejuízo), mas limita a -100% para evitar valores extremos
        if (margin < -100) {
          margin = -100;
        }
      }
      
      // Log para debug - apenas os primeiros 3 pedidos
      if (index < 3) {
        console.log(`[Dashboard API] Pedido ${order.platform_order_id}:`, {
          hasFinancials: !!financialsMap.get(order.id),
          revenue,
          profit,
          orderValue,
          margin,
          financialsData: financials,
        });
      }

      totalRevenue += revenue;
      totalProfit += profit;
      totalOrderValue += orderValue;
      totalOrders += 1;
      // Se aplicamos estimativa de taxas (lucro = receita), adiciona ao total
      if (profitEqualsRevenue && revenue > 0) {
        const marketplaceName = storeInfo?.marketplaceName || 'unknown';
        const marketplaceFeeRate = marketplaceName === 'meli' ? 0.13 : 
                                   marketplaceName === 'shopee' ? 0.11 :
                                   marketplaceName === 'shein' ? 0.09 :
                                   0.11;
        const estimatedFees = revenue * marketplaceFeeRate;
        totalFees += estimatedFees * 0.6; // 60% fees, 40% commissions (aproximação)
        totalCommissions += estimatedFees * 0.4;
      } else {
        // Usa as taxas reais do banco
        totalFees += fees;
        totalCommissions += commissions;
      }

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
          fees: fees,
          commissions: commissions,
          totalFees: fees + commissions, // Total de taxas (fees + commissions)
        };
      } catch (error: any) {
        console.error(`[Dashboard API] Erro ao processar pedido ${order?.id || index}:`, error);
        return null;
      }
    }).filter((order): order is NonNullable<typeof order> => order !== null); // Remove pedidos inválidos

      // VALIDAÇÃO CRÍTICA: Garante que lucro total nunca seja maior que receita total
      let finalTotalProfit = totalProfit;
      if (totalProfit > totalRevenue && totalRevenue > 0 && ordersProcessed && ordersProcessed.length > 0) {
        console.warn(`[Dashboard API] ⚠️⚠️ CORREÇÃO CRÍTICA: Lucro total (${totalProfit}) > Receita total (${totalRevenue}). Recalculando...`);
        // Recalcula somando apenas lucros válidos (lucro <= receita) de cada pedido
        finalTotalProfit = 0;
        ordersProcessed.forEach((order) => {
          if (order && typeof order.profit === 'number' && typeof order.revenue === 'number' && order.profit <= order.revenue) {
            finalTotalProfit += order.profit;
          }
        });
        console.warn(`[Dashboard API] Lucro total recalculado: ${finalTotalProfit}`);
      }
    
    const netRevenue = totalRevenue;
    let averageMargin = 0;
    if (totalRevenue > 0) {
      averageMargin = (finalTotalProfit / totalRevenue) * 100;
      // Valida margem média
      if (averageMargin > 100) {
        console.warn(`[Dashboard API] ⚠️ Margem média inválida (${averageMargin}%). Receita total: ${totalRevenue}, Lucro total: ${finalTotalProfit}. Limitando a 100%`);
        averageMargin = 100;
      }
      if (averageMargin < -100) {
        averageMargin = -100;
      }
    }
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    console.log('[Dashboard API] ========== RESUMO DOS KPIs ==========');
    console.log('[Dashboard API] Total de pedidos:', totalOrders);
    console.log('[Dashboard API] Total de receita:', totalRevenue);
    console.log('[Dashboard API] Total de lucro (bruto):', totalProfit);
    console.log('[Dashboard API] Total de lucro (validado):', finalTotalProfit);
    console.log('[Dashboard API] Total de taxas (fees + commissions):', totalFees + totalCommissions);
    console.log('[Dashboard API] - Fees:', totalFees);
    console.log('[Dashboard API] - Commissions:', totalCommissions);
    console.log('[Dashboard API] Margem média:', averageMargin, '%');
    console.log('[Dashboard API] Ticket médio:', averageTicket);
    console.log('[Dashboard API] Pedidos com dados financeiros:', financialsMap.size, 'de', orders?.length || 0);
    if (totalFees + totalCommissions === 0 && totalRevenue > 0) {
      console.warn('[Dashboard API] ⚠️ ATENÇÃO: Nenhuma taxa encontrada nos dados. Os dados podem ter sido importados antes das correções.');
      console.warn('[Dashboard API] ⚠️ RECOMENDAÇÃO: Reimporte os arquivos Excel para garantir que as taxas sejam salvas corretamente.');
    }
    console.log('[Dashboard API] ====================================');

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
      // CORREÇÃO CRÍTICA: Se lucro agregado > receita agregada, recalcula
      let finalProfit = stats.profit;
      if (stats.profit > stats.revenue && stats.revenue > 0) {
        console.warn(`[Dashboard API] ⚠️⚠️ Lucro agregado (${stats.profit}) > Receita agregada (${stats.revenue}) para ${stats.marketplaceName}. Recalculando...`);
        // Recalcula o lucro agregado somando apenas os lucros válidos dos pedidos individuais
        let recalculatedProfit = 0;
        if (ordersProcessed && ordersProcessed.length > 0) {
          ordersProcessed.forEach((order) => {
            if (order && order.marketplaceName === stats.marketplaceName && 
                typeof order.profit === 'number' && typeof order.revenue === 'number' && 
                order.profit <= order.revenue) {
              recalculatedProfit += order.profit;
            }
          });
        }
        finalProfit = recalculatedProfit;
        console.warn(`[Dashboard API] Lucro recalculado para ${stats.marketplaceName}: ${finalProfit}`);
      }
      
      // Calcula margem agregada, validando consistência
      let margin = 0;
      if (stats.revenue > 0) {
        margin = (finalProfit / stats.revenue) * 100;
        // Valida margem agregada
        if (margin > 100) {
          console.warn(`[Dashboard API] ⚠️ Margem agregada inválida (${margin}%) para ${stats.marketplaceName}. Receita: ${stats.revenue}, Lucro: ${finalProfit}. Limitando a 100%`);
          margin = 100;
        }
        if (margin < -100) {
          margin = -100;
        }
      }
      
      return {
        ...stats,
        profit: finalProfit,
        margin,
        totalFees: stats.totalFees,
        trend: { value: 0, isPositive: true }, // TODO: calcular tendência real
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
          netRevenue,
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
