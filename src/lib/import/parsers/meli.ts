import {
  MarketplaceParser,
  NormalizedOrder,
  ParseResult,
  ParsedRowResult,
  COLUMN_SYNONYMS,
  normalizeHeader,
  findColumnIndex
} from '../types';

/**
 * Parser para planilhas do Mercado Livre (MELI)
 *
 * Suporta planilhas exportadas diretamente do Mercado Livre
 * ou de sistemas de gestão como UpSeller, Bling, Tiny, etc.
 *
 * Características:
 * - Detecção inteligente de colunas por sinônimos
 * - Tolerância a variações de nomenclatura
 * - Logs detalhados por linha
 * - Conversão automática de tipos
 */
class MeliParser implements MarketplaceParser {
  name: 'meli' = 'meli';

  // Indicadores que identificam uma planilha MELI
  private readonly meliIndicators = [
    'mercado',
    'meli',
    'ml-',
    'mercadolivre',
    'mercado livre',
    'nº de venda',
    'numero de venda',
    'n° de venda',
    'número de venda'
  ];

  /**
   * Detecta se a planilha é do Mercado Livre
   */
  detect(headerRow: string[]): boolean {
    const headerText = headerRow.map(h => normalizeHeader(h)).join(' ');

    // IMPORTANTE: Verifica primeiro se NÃO é de outro marketplace
    // Isso evita que planilhas da Shein, Shopee, TikTok sejam detectadas como MELI
    const otherMarketplaceIndicators = [
      'valor de liquidação',    // Shein
      'comissão de vendas',     // Shein
      'taxa de serviço de envio', // Shein
      'descontos sobre vendas', // TikTok
      'ajustes',                // TikTok
      'imposto',                // TikTok
      'taxa de transação',      // Shopee
      'desconto e subsídio da plataforma', // Shopee
      'shopee',
      'tiktok',
      'tik tok',
      'shein'
    ];

    const isOtherMarketplace = otherMarketplaceIndicators.some(indicator =>
      headerText.includes(normalizeHeader(indicator))
    );

    if (isOtherMarketplace) {
      console.log('[MeliParser] Detectado indicador de outro marketplace, ignorando');
      return false;
    }

    // Verifica indicadores diretos do MELI
    const hasIndicator = this.meliIndicators.some(indicator =>
      headerText.includes(normalizeHeader(indicator))
    );

    if (hasIndicator) return true;

    // Verifica padrão de colunas típico do MELI
    const hasMeliOrderColumn = headerRow.some(h => {
      const hLower = normalizeHeader(h);
      return (
        (hLower.includes('venda') || hLower.includes('pedido')) &&
        (hLower.includes('n') || hLower.includes('numero') || hLower.includes('id')) ||
        hLower.includes('ml-') ||
        (hLower.includes('order') && hLower.includes('id'))
      );
    });

    const hasDateColumn = headerRow.some(h => {
      const hLower = normalizeHeader(h);
      return hLower.includes('data') || hLower.includes('date') || hLower.includes('ordenado');
    });

    return hasMeliOrderColumn && hasDateColumn;
  }

  /**
   * Parse principal
   */
  parse(rows: any[][]): NormalizedOrder[] | null {
    const result = this.parseWithLogs(rows);
    return result ? result.orders : null;
  }

  /**
   * Parse com logs detalhados por linha
   */
  parseWithLogs(rows: any[][]): ParseResult | null {
    if (rows.length < 2) {
      return null;
    }

    const headerRow = rows[0].map((h: any) => normalizeHeader(h));

    // Detecta se é uma planilha MELI
    if (!this.detect(headerRow)) {
      return null;
    }

    console.log('[MeliParser] Parser do Mercado Livre acionado.');

    // Mapeia as colunas
    const columnMap = this.mapColumns(headerRow);

    // Verifica colunas obrigatórias
    if (columnMap.platformOrderId === -1 && columnMap.externalOrderId === -1) {
      console.warn('[MeliParser] Nenhuma coluna de identificação de pedido encontrada');
      return null;
    }

    if (columnMap.orderDate === -1) {
      console.warn('[MeliParser] Coluna de data do pedido não encontrada');
      return null;
    }

    const orders: NormalizedOrder[] = [];
    const rowResults: ParsedRowResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Processa cada linha
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1; // 1-indexed para o usuário
      const rawData = this.rowToObject(rows[0], row);

      // Ignora linhas completamente vazias
      if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === '')) {
        rowResults.push({
          success: false,
          rowNumber,
          errorMessage: 'Linha vazia',
          rawData
        });
        skippedCount++;
        continue;
      }

      try {
        const result = this.parseRow(row, columnMap, rowNumber);

        if (result.success && result.order) {
          orders.push(result.order);
          successCount++;
        } else if (result.errorMessage?.includes('ignorad') || result.errorMessage?.includes('duplicad')) {
          skippedCount++;
        } else {
          errorCount++;
        }

        rowResults.push({
          ...result,
          rawData
        });
      } catch (error: any) {
        errorCount++;
        rowResults.push({
          success: false,
          rowNumber,
          errorMessage: `Erro inesperado: ${error.message}`,
          rawData
        });
        console.warn(`[MeliParser] Erro ao processar linha ${rowNumber}:`, error);
      }
    }

    if (orders.length === 0) {
      console.warn('[MeliParser] Nenhum pedido válido encontrado na planilha');
      return null;
    }

    console.log(`[MeliParser] ✅ ${orders.length} pedidos processados com sucesso`);

    return {
      orders,
      rowResults,
      totalRows: rows.length - 1,
      successCount,
      errorCount,
      skippedCount
    };
  }

  /**
   * Mapeia todas as colunas da planilha
   */
  private mapColumns(headerRow: string[]): Record<string, number> {
    const map: Record<string, number> = {
      orderDate: findColumnIndex(headerRow, 'orderDate'),
      settlementDate: findColumnIndex(headerRow, 'settlementDate'),
      platformOrderId: findColumnIndex(headerRow, 'platformOrderId'),
      externalOrderId: findColumnIndex(headerRow, 'externalOrderId'),
      sku: findColumnIndex(headerRow, 'sku'),
      quantity: findColumnIndex(headerRow, 'quantity'),
      orderValue: findColumnIndex(headerRow, 'orderValue'),
      revenue: findColumnIndex(headerRow, 'revenue'),
      productSales: findColumnIndex(headerRow, 'productSales'),
      shippingFeeBuyer: findColumnIndex(headerRow, 'shippingFeeBuyer'),
      platformDiscount: findColumnIndex(headerRow, 'platformDiscount'),
      commissions: findColumnIndex(headerRow, 'commissions'),
      transactionFee: findColumnIndex(headerRow, 'transactionFee'),
      shippingFee: findColumnIndex(headerRow, 'shippingFee'),
      otherPlatformFees: findColumnIndex(headerRow, 'otherPlatformFees'),
      refunds: findColumnIndex(headerRow, 'refunds'),
      productCost: findColumnIndex(headerRow, 'productCost'),
      profit: findColumnIndex(headerRow, 'profit'),
      profitMargin: findColumnIndex(headerRow, 'profitMargin'),
      storeName: findColumnIndex(headerRow, 'storeName'),
      platformName: findColumnIndex(headerRow, 'platformName')
    };

    // Log de mapeamento para debug
    const mappedFields = Object.entries(map)
      .filter(([, idx]) => idx !== -1)
      .map(([field, idx]) => `${field}: ${idx}`);

    console.log(`[MeliParser] Mapeamento de colunas (${mappedFields.length} campos):`, mappedFields.join(', '));

    return map;
  }

  /**
   * Processa uma linha individual
   */
  private parseRow(row: any[], columnMap: Record<string, number>, rowNumber: number): ParsedRowResult {
    const getValue = (fieldName: string): any => {
      const index = columnMap[fieldName];
      if (index === -1 || index >= row.length) return undefined;
      return row[index];
    };

    // Obtém ID do pedido (prioriza plataforma, depois externo)
    let platformOrderId = getValue('platformOrderId');
    const externalOrderId = getValue('externalOrderId');

    // Se não tem ID da plataforma, usa o externo
    if (!platformOrderId && externalOrderId) {
      platformOrderId = externalOrderId;
    }

    if (!platformOrderId) {
      return {
        success: false,
        rowNumber,
        errorMessage: 'ID do pedido não encontrado',
        rawData: {}
      };
    }

    // Processa a data do pedido
    const orderDateRaw = getValue('orderDate');
    const orderDate = this.parseDate(orderDateRaw);

    if (!orderDate) {
      return {
        success: false,
        rowNumber,
        errorMessage: `Data do pedido inválida: "${orderDateRaw}"`,
        rawData: {}
      };
    }

    // Processa valores numéricos básicos
    const orderValue = this.parseNumber(getValue('orderValue'));
    const revenue = this.parseNumber(getValue('revenue')) || orderValue;
    const productSales = this.parseNumber(getValue('productSales'));

    // Processa taxas detalhadas
    const shippingFeeBuyer = this.parseNumber(getValue('shippingFeeBuyer'));
    const platformDiscount = this.parseNumber(getValue('platformDiscount'));
    const commissions = Math.abs(this.parseNumber(getValue('commissions'))); // Garante positivo
    const transactionFee = Math.abs(this.parseNumber(getValue('transactionFee')));
    const shippingFee = Math.abs(this.parseNumber(getValue('shippingFee')));
    const otherPlatformFees = Math.abs(this.parseNumber(getValue('otherPlatformFees')));
    const refunds = this.parseNumber(getValue('refunds'));
    const productCost = this.parseNumber(getValue('productCost'));

    // Calcula total de taxas (excluindo comissões que são separadas)
    const totalFees = transactionFee + shippingFee + otherPlatformFees;

    // Processa lucro e margem
    let profit = this.parseNumber(getValue('profit'));
    let profitMargin = this.parsePercentage(getValue('profitMargin'));

    // Se não tem lucro da planilha ou está zerado, calcula
    // IMPORTANTE: revenue (= "Receita de venda") já vem com comissões e taxas descontadas.
    // Portanto, lucro = revenue - custo do produto - reembolsos.
    // NÃO subtrair comissões/taxas novamente.
    const baseRevenue = revenue || productSales || orderValue;
    if (profit === 0 && baseRevenue > 0) {
      profit = baseRevenue - productCost - refunds;
    }

    // Se não tem margem da planilha, calcula sobre o valor do pedido
    const marginBase = orderValue > 0 ? orderValue : baseRevenue;
    if (profitMargin === 0 && marginBase > 0) {
      profitMargin = (profit / marginBase) * 100;
    }

    // Monta o objeto do pedido
    const order: NormalizedOrder = {
      platform_order_id: String(platformOrderId).trim(),
      external_order_id: externalOrderId ? String(externalOrderId).trim() : undefined,
      platform_name: getValue('platformName') ? String(getValue('platformName')).trim() : 'Mercado Livre',
      store_name: getValue('storeName') ? String(getValue('storeName')).trim() : undefined,
      order_date: orderDate,
      settlement_date: this.parseDate(getValue('settlementDate')),
      sku: String(getValue('sku') || 'N/A').trim(),
      quantity: this.parseNumber(getValue('quantity')) || 1,
      order_value: orderValue > 0 ? orderValue : baseRevenue,
      revenue: baseRevenue,
      product_sales: productSales || undefined,
      shipping_fee_buyer: shippingFeeBuyer || undefined,
      platform_discount: platformDiscount || undefined,
      commissions: commissions || undefined,
      transaction_fee: transactionFee || undefined,
      shipping_fee: shippingFee || undefined,
      other_platform_fees: otherPlatformFees || undefined,
      total_fees: totalFees, // Campo legado - agora é total_fees
      refunds: refunds || undefined,
      product_cost: productCost || undefined,
      profit: profit,
      profit_margin: profitMargin
    };

    // Gera warnings se necessário
    let warningMessage: string | undefined;

    if (profit < 0) {
      warningMessage = `Margem negativa: R$ ${profit.toFixed(2)}`;
    } else if (productCost === 0 && productSales > 0) {
      warningMessage = 'Custo do produto não informado';
    }

    return {
      success: true,
      order,
      rowNumber,
      warningMessage,
      rawData: {}
    };
  }

  /**
   * Converte uma linha em objeto para log
   */
  private rowToObject(headerRow: any[], row: any[]): Record<string, any> {
    const obj: Record<string, any> = {};
    for (let i = 0; i < headerRow.length && i < row.length; i++) {
      obj[String(headerRow[i] || `col_${i}`)] = row[i];
    }
    return obj;
  }

  /**
   * Converte valor para data
   */
  private parseDate(value: any): Date | undefined {
    if (!value) return undefined;

    // Se já é Date
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value;
    }

    // Se é string
    if (typeof value === 'string') {
      const trimmed = value.trim();

      // Formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const date = new Date(trimmed + 'T00:00:00');
        return isNaN(date.getTime()) ? undefined : date;
      }

      // Formato DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return isNaN(date.getTime()) ? undefined : date;
      }

      // Formato DD-MM-YYYY
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return isNaN(date.getTime()) ? undefined : date;
      }

      // Tenta parse genérico
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? undefined : date;
    }

    // Se é número (Excel serial date)
    if (typeof value === 'number') {
      // Excel serial date: dias desde 1900-01-01 (com bug do leap year)
      const date = new Date((value - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
  }

  /**
   * Converte valor para número
   */
  private parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    if (typeof value === 'string') {
      // Remove símbolos de moeda e espaços
      let cleaned = value
        .replace(/R\$|US\$|\$|€/g, '')
        .replace(/\s/g, '')
        .trim();

      // Detecta formato brasileiro (1.234,56) vs americano (1,234.56)
      const hasCommaDecimal = /\d,\d{2}$/.test(cleaned);
      const hasDotDecimal = /\d\.\d{2}$/.test(cleaned);

      if (hasCommaDecimal && !hasDotDecimal) {
        // Formato brasileiro: remove pontos de milhar, troca vírgula por ponto
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (hasDotDecimal && !hasCommaDecimal) {
        // Formato americano: remove vírgulas de milhar
        cleaned = cleaned.replace(/,/g, '');
      }

      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    return 0;
  }

  /**
   * Converte valor percentual para número
   */
  private parsePercentage(value: any): number {
    if (value === null || value === undefined || value === '') return 0;

    if (typeof value === 'number') {
      // Se já está em formato decimal (0.75) converte para percentual (75)
      return value < 1 && value > 0 ? value * 100 : value;
    }

    if (typeof value === 'string') {
      // Remove símbolo de porcentagem
      const cleaned = value.replace('%', '').trim();
      const num = this.parseNumber(cleaned);
      return num;
    }

    return 0;
  }
}

export default new MeliParser();
