import { MarketplaceName, NormalizedOrder } from '../types';
import meliParser from './meli';
import shopeeParser from './shopee';
import sheinParser from './shein';
import tiktokParser from './tiktok';

// Mapeia os nomes dos marketplaces para suas respectivas implementações de parser
const parsers = {
  meli: meliParser,
  shopee: shopeeParser,
  shein: sheinParser,
  tiktok: tiktokParser,
};

// Resultado da detecção e do parsing
interface ParserResult {
  marketplaceName: MarketplaceName;
  normalizedData: NormalizedOrder[];
}

/**
 * Detecção específica para planilhas agregadoras (ex.: UpSeller).
 * Regra principal:
 * - Se houver: Plataforma + Nº de Pedido de Plataforma + uma coluna de data
 *   então tentamos importar, mesmo que não siga o layout nativo do marketplace.
 */
function tryDetectAggregatorFormat(rows: any[][]): ParserResult | null {
  if (!rows || rows.length < 2) return null;

  const headerRaw = rows[0] ?? [];
  const header = headerRaw.map((h) => String(h ?? '').trim());
  const headerLower = header.map((h) => h.toLowerCase());

  // CORREÇÃO 1: Match exato primeiro para evitar confundir com "Nº de Pedido de Plataforma"
  const idxPlatform = headerLower.findIndex((h) => h === 'plataforma');
  // Se não encontrar exato, tenta includes (mas com cuidado)
  const idxPlatformFallback = idxPlatform === -1 
    ? headerLower.findIndex((h) => h.includes('plataforma') && !h.includes('pedido'))
    : -1;
  const finalIdxPlatform = idxPlatform !== -1 ? idxPlatform : idxPlatformFallback;

  const idxOrderId = headerLower.findIndex(
    (h) =>
      h.includes('nº de pedido de plataforma') ||
      h.includes('no de pedido de plataforma') ||
      (h.includes('pedido') && h.includes('plataforma'))
  );

  // Aceita qualquer coluna que pareça data: Ordenado, Liquidação, Data, Date, Time...
  const dateCandidates = ['ordenado', 'liquidação', 'liquidacao', 'data', 'date', 'time'];
  const idxOrderDate = headerLower.findIndex((h) =>
    dateCandidates.some((dc) => h.includes(dc))
  );

  console.log('[Aggregator] Índices detectados:', {
    idxPlatform: finalIdxPlatform,
    idxOrderId,
    idxOrderDate,
  });

  // Critério mínimo para considerar formato agregador
  if (finalIdxPlatform === -1 || idxOrderId === -1 || idxOrderDate === -1) {
    console.warn(
      '[Aggregator] Critérios mínimos não atendidos (Plataforma + Nº de Pedido de Plataforma + coluna de data).'
    );
    return null;
  }

  // CORREÇÃO 2: Inferência melhorada - aceita "Mercado" sozinho e normaliza melhor
  const inferMarketplaceFromPlatform = (value: string): MarketplaceName | null => {
    // Normaliza: remove acentos, espaços extras, converte para lowercase
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Aceita "mercado" sozinho (comum em relatórios UpSeller)
    if (normalized === 'mercado' || normalized.includes('mercado')) return 'meli';
    if (normalized.includes('ml') || normalized.includes('mercadolivre')) return 'meli';
    if (normalized.includes('shopee')) return 'shopee';
    if (normalized.includes('shein')) return 'shein';
    if (normalized.includes('tiktok') || normalized.includes('tik tok')) return 'tiktok';
    return null;
  };

  let inferredMarketplace: MarketplaceName | null = null;
  let platformSample = '';

  // Tenta inferir a partir das primeiras linhas com dados
  for (let i = 1; i < rows.length; i++) {
    const cell = rows[i]?.[finalIdxPlatform];
    if (cell == null) continue;
    const platformStr = String(cell).trim();
    if (!platformStr) continue;

    platformSample = platformStr;
    const mp = inferMarketplaceFromPlatform(platformStr);
    if (mp) {
      inferredMarketplace = mp;
      console.log('[Aggregator] Plataforma detectada:', platformStr, '→ marketplace:', mp);
      break;
    }
  }

  // CORREÇÃO 3: Fallback inteligente - se não conseguiu inferir, tenta usar o primeiro marketplace válido
  // como padrão baseado no valor bruto da coluna
  if (!inferredMarketplace && platformSample) {
    console.warn(
      `[Aggregator] Não foi possível inferir marketplace exato a partir de "${platformSample}". Tentando fallback...`
    );
    // Tenta uma última vez com heurística mais permissiva
    const fallback = inferMarketplaceFromPlatform(platformSample);
    if (fallback) {
      inferredMarketplace = fallback;
      console.log('[Aggregator] Fallback aplicado:', platformSample, '→ marketplace:', fallback);
    } else {
      // Se ainda assim não conseguir, usa meli como padrão (mais comum em relatórios brasileiros)
      // mas loga um aviso
      console.warn(
        `[Aggregator] Usando fallback padrão 'meli' para valor não reconhecido: "${platformSample}"`
      );
      inferredMarketplace = 'meli';
    }
  } else if (!inferredMarketplace) {
    // Se nem conseguiu ler a coluna Plataforma, não pode continuar
    console.error(
      '[Aggregator] Não foi possível ler nenhum valor da coluna Plataforma. Abortando.'
    );
    return null;
  }

  // Helpers
  const parseDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      const d = new Date(Math.round((value - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? undefined : d;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  };

  const parseMoney = (value: any): number => {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value;
    const s = String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  // Campos financeiros opcionais
  const idxOrderValue = headerLower.findIndex((h) => h.includes('valor do pedido'));
  const idxRevenue = headerLower.findIndex(
    (h) => h === 'receita' || h.includes('valor de liquidação') || h.includes('valor de liquidacao')
  );
  const idxProductSales = headerLower.findIndex((h) => h.includes('vendas de produtos'));
  const idxCommissions = headerLower.findIndex(
    (h) => h.startsWith('comissão') || h.startsWith('comissao') || h === 'comissão' || h === 'comissao'
  );
  
  // Mapear todas as taxas e custos do UpSeller
  const idxProductCost = headerLower.findIndex((h) => 
    h.includes('custo do produto') || h.includes('custo')
  );
  // Detecção mais flexível de taxas - tenta múltiplas variações
  const idxTransactionFee = headerLower.findIndex((h) => 
    h.includes('taxa de transação') || h.includes('taxa de transacao') || 
    h.includes('transaction fee') || h.includes('taxa transação')
  );
  const idxServiceFee = headerLower.findIndex((h) => 
    h.includes('taxa de serviço') || h.includes('taxa de servico') ||
    h.includes('service fee') || h.includes('taxa serviço')
  );
  // Prioriza "Taxa do Frete" exata, depois "Taxa de Frete", depois qualquer coisa com "frete" (exceto "paga pelo comprador")
  const idxFreightFee = headerLower.findIndex((h) => 
    h === 'taxa do frete' || h === 'taxa de frete'
  );
  // Se não encontrou exato, procura qualquer coisa com frete (exceto "paga pelo comprador")
  const idxFreightFeeFallback = idxFreightFee === -1 
    ? headerLower.findIndex((h) => 
        h.includes('frete') && !h.includes('paga pelo comprador') && !h.includes('taxa de frete paga')
      )
    : -1;
  const finalIdxFreightFee = idxFreightFee !== -1 ? idxFreightFee : idxFreightFeeFallback;
  const idxOtherPlatformFee = headerLower.findIndex((h) => 
    h.includes('outra taxa da plataforma') || h.includes('outra taxa') ||
    h.includes('other platform fee') || h.includes('outras taxas')
  );
  const idxRefunds = headerLower.findIndex((h) => 
    h.includes('reembolso') || h.includes('reemb')
  );
  
  // Log dos índices encontrados para debug
  console.log('[Aggregator] ========== MAPEAMENTO DE COLUNAS ==========');
  console.log('[Aggregator] Cabeçalho completo:', header);
  console.log('[Aggregator] Índices de colunas financeiras encontrados:', {
    productCost: idxProductCost !== -1 ? `${idxProductCost}: ${header[idxProductCost]}` : 'não encontrado',
    transactionFee: idxTransactionFee !== -1 ? `${idxTransactionFee}: ${header[idxTransactionFee]}` : 'não encontrado',
    serviceFee: idxServiceFee !== -1 ? `${idxServiceFee}: ${header[idxServiceFee]}` : 'não encontrado',
    freightFee: finalIdxFreightFee !== -1 ? `${finalIdxFreightFee}: ${header[finalIdxFreightFee]}` : 'não encontrado',
    otherPlatformFee: idxOtherPlatformFee !== -1 ? `${idxOtherPlatformFee}: ${header[idxOtherPlatformFee]}` : 'não encontrado',
    refunds: idxRefunds !== -1 ? `${idxRefunds}: ${header[idxRefunds]}` : 'não encontrado',
    commissions: idxCommissions !== -1 ? `${idxCommissions}: ${header[idxCommissions]}` : 'não encontrado',
  });
  console.log('[Aggregator] ===========================================');
  
  // Se já existe uma coluna "Lucro" calculada, podemos usá-la como referência
  const idxProfit = headerLower.findIndex((h) => 
    h === 'lucro' && !h.includes('margem')
  );

  const normalized: NormalizedOrder[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawOrderId = row[idxOrderId];
    const rawOrderDate = row[idxOrderDate];
    // Nota: não precisamos mais ler idxPlatform aqui, já inferimos o marketplace acima

    const orderDate = parseDate(rawOrderDate);
    if (!rawOrderId || !orderDate) {
      console.warn('[Aggregator] Linha ignorada (falta ID de pedido ou data inválida):', {
        rowIndex: i + 1,
        rawOrderId,
        rawOrderDate,
      });
      continue;
    }

    const orderValue = idxOrderValue !== -1 ? parseMoney(row[idxOrderValue]) : 0;
    const revenue = idxRevenue !== -1 ? parseMoney(row[idxRevenue]) : undefined;
    const productSales =
      idxProductSales !== -1 ? parseMoney(row[idxProductSales]) : undefined;
    const commissions =
      idxCommissions !== -1 ? parseMoney(row[idxCommissions]) : undefined;
    
    // Lê todos os custos e taxas
    const productCost = idxProductCost !== -1 ? parseMoney(row[idxProductCost]) : undefined;
    const transactionFee = idxTransactionFee !== -1 ? parseMoney(row[idxTransactionFee]) : undefined;
    const serviceFee = idxServiceFee !== -1 ? parseMoney(row[idxServiceFee]) : undefined;
    const freightFee = finalIdxFreightFee !== -1 ? parseMoney(row[finalIdxFreightFee]) : undefined;
    const otherPlatformFee = idxOtherPlatformFee !== -1 ? parseMoney(row[idxOtherPlatformFee]) : undefined;
    const refunds = idxRefunds !== -1 ? parseMoney(row[idxRefunds]) : undefined;
    
    // Soma todas as taxas (exceto comissão que já está separada)
    const totalFees = (transactionFee ?? 0) + (serviceFee ?? 0) + (freightFee ?? 0) + (otherPlatformFee ?? 0);
    
    // Revenue base: receita ou vendas de produtos ou valor do pedido
    const baseRevenue = revenue ?? productSales ?? orderValue;
    
    // Log dos primeiros 3 pedidos para debug
    if (i <= 3) {
      console.log(`[Aggregator] Pedido ${rawOrderId} - Valores lidos:`, {
        revenue: baseRevenue,
        productCost,
        commissions,
        transactionFee,
        serviceFee,
        freightFee,
        otherPlatformFee,
        totalFees,
        refunds,
        calculatedProfit: baseRevenue - (productCost ?? 0) - (commissions ?? 0) - totalFees - (refunds ?? 0)
      });
    }
    
    // Calcula o lucro corretamente: Revenue - Custo do Produto - Comissões - Taxas - Reembolsos
    let profit: number | undefined = undefined;
    let profitMargin: number | undefined = undefined;

    if (baseRevenue != null && baseRevenue > 0) {
      const costValue = productCost ?? 0;
      // Comissões podem vir como negativas (descontos), então usa valor absoluto
      const commissionsValue = commissions != null ? Math.abs(commissions) : 0;
      const refundsValue = refunds ?? 0;
      
      // Calcula o lucro correto baseado nos custos
      // Lucro = Receita - Custo do Produto - Comissões (absoluto) - Taxas - Reembolsos
      const calculatedProfit = baseRevenue - costValue - commissionsValue - totalFees - refundsValue;
      
      // Se existe uma coluna "Lucro" na planilha, valida se está consistente
      if (idxProfit !== -1) {
        const profitFromSheet = parseMoney(row[idxProfit]);
        // Valida: lucro não pode ser maior que receita, e não pode ser muito diferente do calculado
        // Se o lucro da planilha for maior que a receita ou muito diferente do calculado, usa o calculado
        if (profitFromSheet !== 0 && profitFromSheet <= baseRevenue && Math.abs(profitFromSheet - calculatedProfit) < baseRevenue * 0.1) {
          // Lucro da planilha parece válido (dentro de 10% de diferença)
          profit = profitFromSheet;
        } else {
          // Lucro da planilha está inconsistente, usa o calculado
          console.warn(`[Aggregator] Lucro da planilha inconsistente (${profitFromSheet}) para pedido ${rawOrderId}. Usando cálculo: ${calculatedProfit}`);
          profit = calculatedProfit;
        }
      } else {
        // Não tem coluna de lucro, usa o calculado
        profit = calculatedProfit;
      }
      
      // Calcula a margem
      if (baseRevenue > 0) {
        profitMargin = (profit / baseRevenue) * 100;
      }
    }

    // Valida se tem revenue válido antes de adicionar
    if (!baseRevenue || baseRevenue <= 0) {
      console.warn(`[Aggregator] Linha ${i + 1} ignorada: revenue inválido (${baseRevenue}) para pedido ${rawOrderId}`);
      continue;
    }
    
    normalized.push({
      platform_order_id: String(rawOrderId),
      order_date: orderDate,
      settlement_date: undefined,
      sku: 'N/A', // agregador não traz SKU detalhado neste layout
      quantity: 1,
      order_value: orderValue || baseRevenue || 0,
      revenue: baseRevenue,
      product_sales: productSales,
      // Salva comissões como valor absoluto (sempre positivo no banco)
      commissions: commissions != null ? Math.abs(commissions) : undefined,
      fees: totalFees > 0 ? totalFees : undefined,
      refunds: refunds && refunds > 0 ? refunds : undefined,
      product_cost: productCost,
      profit,
      profit_margin: profitMargin,
    });
  }

  if (normalized.length === 0) {
    console.warn('[Aggregator] Nenhuma linha válida encontrada após normalização.');
    return null;
  }

  // Resumo das taxas encontradas
  const ordersWithFees = normalized.filter(o => (o.fees ?? 0) > 0 || (o.commissions ?? 0) > 0).length;
  const totalFeesSum = normalized.reduce((sum, o) => sum + (o.fees ?? 0), 0);
  const totalCommissionsSum = normalized.reduce((sum, o) => sum + (o.commissions ?? 0), 0);
  
  console.log(
    `[Aggregator] ✅ ${normalized.length} pedidos normalizados para ${inferredMarketplace}`
  );
  console.log(`[Aggregator] 📊 Resumo financeiro:`, {
    pedidosComTaxas: ordersWithFees,
    totalTaxas: totalFeesSum,
    totalComissoes: totalCommissionsSum,
    pedidosComCusto: normalized.filter(o => (o.product_cost ?? 0) > 0).length,
  });

  return {
    marketplaceName: inferredMarketplace,
    normalizedData: normalized,
  };
}

/**
 * Tenta identificar o marketplace e fazer o parsing dos dados da planilha.
 * Fluxo:
 * 1) Tenta parsers nativos (layouts oficiais).
 * 2) Se nenhum bater, tenta formato agregador (UpSeller/hub).
 */
export function detectAndParse(rows: any[][]): ParserResult | null {
  if (!rows || rows.length === 0) {
    console.warn('[detectAndParse] Planilha vazia ou sem dados.');
    return null;
  }

  if (rows.length > 0) {
    const headerRow = rows[0];
    console.log('[detectAndParse] Cabeçalho da planilha:', headerRow);
    console.log(
      '[detectAndParse] Cabeçalho (normalizado):',
      headerRow.map((h: any) => String(h ?? '').toLowerCase().trim())
    );
  }

  // 1) Parsers nativos
  const parserNames = Object.keys(parsers);
  console.log(
    `[detectAndParse] Tentando ${parserNames.length} parsers nativos: ${parserNames.join(', ')}`
  );

  for (const [name, parser] of Object.entries(parsers)) {
    try {
      console.log(`[detectAndParse] Tentando parser nativo: ${name}...`);
      const normalizedData = parser.parse(rows);
      if (normalizedData && normalizedData.length > 0) {
        console.log(
          `[detectAndParse] ✅ Marketplace nativo identificado: ${name} (${normalizedData.length} pedidos)`
        );
        return {
          marketplaceName: name as MarketplaceName,
          normalizedData,
        };
      } else {
        console.log(`[detectAndParse] Parser ${name} não identificou a planilha`);
      }
    } catch (error: any) {
      console.error(
        `[detectAndParse] Erro ao tentar o parser '${name}':`,
        error?.message || error
      );
      console.error(`[detectAndParse] Stack do parser ${name}:`, error?.stack);
    }
  }

  // 2) Formato agregador (UpSeller / hub)
  console.log('[detectAndParse] Tentando formato agregador (UpSeller/hub)...');
  const aggregatorResult = tryDetectAggregatorFormat(rows);
  if (aggregatorResult) {
    return aggregatorResult;
  }

  console.error('[detectAndParse] ❌ Nenhum parser compatível (nativo ou agregador) encontrado.');
  console.error('[detectAndParse] Cabeçalho recebido:', rows[0]);
  console.error('[detectAndParse] Total de linhas:', rows.length);
  return null;
}
