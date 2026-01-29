import { MarketplaceParser, NormalizedOrder } from '../types';

class TikTokParser implements MarketplaceParser {
  parse(rows: any[][]): NormalizedOrder[] | null {
    if (rows.length < 2) {
      console.log('[TikTokParser] Planilha tem menos de 2 linhas');
      return null;
    }

    const headerRow = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
    console.log('[TikTokParser] Cabeçalho detectado:', headerRow);

    const isTikTok = this.isTikTokSheet(headerRow);
    if (!isTikTok) {
      console.log('[TikTokParser] Planilha não identificada como TikTok');
      return null;
    }

    console.log('[TikTokParser] ✅ Planilha identificada como TikTok');
    const columnMap = this.mapColumns(headerRow);
    console.log('[TikTokParser] Mapeamento de colunas:', columnMap);

    if (columnMap.orderId === undefined || columnMap.orderDate === undefined) {
      console.warn('[TikTokParser] ❌ Colunas obrigatórias não encontradas');
      return null;
    }

    const normalizedOrders: NormalizedOrder[] = [];
    let skippedRows = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) {
        skippedRows++;
        continue;
      }

      try {
        const order = this.parseRow(row, columnMap, i);
        if (order) {
          normalizedOrders.push(order);
        } else {
          skippedRows++;
        }
      } catch (error: any) {
        console.warn(`[TikTokParser] Erro ao processar linha ${i + 1}:`, error.message);
        skippedRows++;
        continue;
      }
    }

    console.log(`[TikTokParser] ✅ Processamento concluído: ${normalizedOrders.length} pedidos normalizados, ${skippedRows} linhas ignoradas`);
    return normalizedOrders.length > 0 ? normalizedOrders : null;
  }

  private isTikTokSheet(headerRow: string[]): boolean {
    const headerText = headerRow.join(' ').toLowerCase();

    // Indicadores específicos do TikTok
    const tiktokIndicators = [
      'tiktok',
      'tik tok',
      'taxa de serviço',  // Específico do TikTok (diferente de "taxa de serviço de envio" da Shein)
      'descontos sobre vendas',
      'ajustes'
    ];

    const hasTikTokIndicator = tiktokIndicators.some(ind => headerText.includes(ind));

    // Verifica se NÃO é Shein (tem colunas similares)
    const sheinIndicators = ['valor de liquidação', 'taxa de serviço de envio', 'comissão de vendas'];
    const isShein = sheinIndicators.some(ind => headerText.includes(ind));

    if (isShein) {
      console.log('[TikTokParser] Detectado como Shein, não TikTok');
      return false;
    }

    // Verifica colunas típicas do relatório UpSeller para TikTok
    const hasUpsellerColumns =
      headerText.includes('nº de pedido de plataforma') &&
      headerText.includes('valor do pedido') &&
      (headerText.includes('taxa de serviço') || headerText.includes('descontos sobre vendas'));

    const result = hasTikTokIndicator || hasUpsellerColumns;

    if (!result) {
      console.log('[TikTokParser] Não identificado como TikTok. Texto do cabeçalho:', headerText.substring(0, 300));
    }

    return result;
  }

  private mapColumns(headerRow: string[]): any {
    const map: any = {};

    headerRow.forEach((header, index) => {
      const h = header.toLowerCase().trim().replace(/\r?\n/g, ' ');

      // Order ID - Nº de Pedido de Plataforma
      if (map.orderId === undefined && (
        h.includes('nº de pedido de plataforma') ||
        h.includes('numero de pedido de plataforma') ||
        h.includes('order id') ||
        h.includes('order sn') ||
        h === 'pedido'
      )) {
        map.orderId = index;
        console.log(`[TikTokParser] ✅ Order ID: coluna ${index} "${header}"`);
      }

      // External Order ID - Nº de Pedido de UpSeller
      if (map.externalOrderId === undefined && (
        h.includes('nº de pedido de upseller') ||
        h.includes('numero de pedido de upseller') ||
        h.includes('upseller')
      )) {
        map.externalOrderId = index;
        console.log(`[TikTokParser] ✅ External Order ID: coluna ${index} "${header}"`);
      }

      // Order Date - Ordenado
      if (map.orderDate === undefined && (
        h === 'ordenado' ||
        h.includes('order date') ||
        h.includes('order time') ||
        h.includes('create time') ||
        h.includes('data do pedido')
      )) {
        map.orderDate = index;
        console.log(`[TikTokParser] ✅ Order Date: coluna ${index} "${header}"`);
      }

      // Settlement Date - Liquidação
      if (map.settlementDate === undefined && (
        h === 'liquidação' ||
        h.includes('settlement') ||
        h.includes('data de liquidação')
      )) {
        map.settlementDate = index;
        console.log(`[TikTokParser] ✅ Settlement Date: coluna ${index} "${header}"`);
      }

      // Platform Name
      if (map.platformName === undefined && (
        h === 'plataforma' ||
        h === 'platform'
      )) {
        map.platformName = index;
      }

      // Store Name
      if (map.storeName === undefined && (
        h === 'loja' ||
        h === 'store' ||
        h === 'shop'
      )) {
        map.storeName = index;
      }

      // Order Value - Valor do Pedido
      if (map.orderValue === undefined && (
        h === 'valor do pedido' ||
        h.includes('order value') ||
        h.includes('order amount')
      )) {
        map.orderValue = index;
        console.log(`[TikTokParser] ✅ Order Value: coluna ${index} "${header}"`);
      }

      // Revenue - Receita
      if (map.revenue === undefined && (
        h === 'receita' ||
        h === 'revenue'
      )) {
        map.revenue = index;
        console.log(`[TikTokParser] ✅ Revenue: coluna ${index} "${header}"`);
      }

      // Product Sales - Vendas de Produtos
      if (map.productSales === undefined && (
        h === 'vendas de produtos' ||
        h.includes('product sales')
      )) {
        map.productSales = index;
        console.log(`[TikTokParser] ✅ Product Sales: coluna ${index} "${header}"`);
      }

      // Platform Discount - Descontos sobre Vendas
      if (map.platformDiscount === undefined && (
        h === 'descontos sobre vendas' ||
        h.includes('discount') ||
        h.includes('desconto')
      )) {
        map.platformDiscount = index;
        console.log(`[TikTokParser] ✅ Platform Discount: coluna ${index} "${header}"`);
      }

      // Commissions - Comissão
      if (map.commissions === undefined && (
        h === 'comissão' ||
        h.includes('commission')
      )) {
        map.commissions = index;
        console.log(`[TikTokParser] ✅ Commissions: coluna ${index} "${header}"`);
      }

      // Transaction Fee - Taxa de Serviço
      if (map.transactionFee === undefined && (
        h === 'taxa de serviço' ||
        h.includes('service fee') ||
        h.includes('transaction fee')
      )) {
        map.transactionFee = index;
        console.log(`[TikTokParser] ✅ Transaction Fee: coluna ${index} "${header}"`);
      }

      // Other Platform Fees - Outra Taxa da Plataforma
      if (map.otherPlatformFees === undefined && (
        h === 'outra taxa da plataforma' ||
        h.includes('other fee') ||
        h.includes('platform fee')
      )) {
        map.otherPlatformFees = index;
        console.log(`[TikTokParser] ✅ Other Platform Fees: coluna ${index} "${header}"`);
      }

      // Shipping Fee - Taxa do Frete
      if (map.shippingFee === undefined && (
        h === 'taxa do frete' ||
        h.includes('shipping fee') ||
        h.includes('taxa de frete')
      )) {
        map.shippingFee = index;
        console.log(`[TikTokParser] ✅ Shipping Fee: coluna ${index} "${header}"`);
      }

      // Refunds - Reembolso
      if (map.refunds === undefined && (
        h === 'reembolso' ||
        h.includes('refund')
      )) {
        map.refunds = index;
        console.log(`[TikTokParser] ✅ Refunds: coluna ${index} "${header}"`);
      }

      // SKU - SKU Mapeado
      if (map.sku === undefined && (
        h.includes('sku mapeado') ||
        h.includes('sku') ||
        h.includes('product sku')
      )) {
        map.sku = index;
        console.log(`[TikTokParser] ✅ SKU: coluna ${index} "${header}"`);
      }

      // Quantity - Qty. do Anúncio
      if (map.quantity === undefined && (
        h.includes('qty') ||
        h.includes('quantity') ||
        h.includes('quantidade')
      )) {
        map.quantity = index;
        console.log(`[TikTokParser] ✅ Quantity: coluna ${index} "${header}"`);
      }

      // Product Cost - Custo do Produto
      if (map.productCost === undefined && (
        h === 'custo do produto' ||
        h.includes('product cost')
      )) {
        map.productCost = index;
        console.log(`[TikTokParser] ✅ Product Cost: coluna ${index} "${header}"`);
      }

      // Profit - Lucro
      if (map.profit === undefined && (
        h === 'lucro' ||
        h === 'profit'
      )) {
        map.profit = index;
        console.log(`[TikTokParser] ✅ Profit: coluna ${index} "${header}"`);
      }

      // Profit Margin - Margem de Lucro
      if (map.profitMargin === undefined && (
        h === 'margem de lucro' ||
        h.includes('profit margin') ||
        h.includes('margem')
      )) {
        map.profitMargin = index;
        console.log(`[TikTokParser] ✅ Profit Margin: coluna ${index} "${header}"`);
      }
    });

    return map;
  }

  private parseRow(row: any[], columnMap: any, rowIndex: number): NormalizedOrder | null {
    const getValue = (index?: number) => index !== undefined && row[index] !== undefined ? row[index] : undefined;

    const parseDate = (value: any): Date | undefined => {
      if (!value) return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date;
        // Formato DD/MM/YYYY
        const parts = value.split(/[\/\-]/);
        if (parts.length === 3) {
          const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          if (!isNaN(d.getTime())) return d;
        }
        return undefined;
      }
      if (typeof value === 'number') {
        // Excel date serial number
        const date = new Date((value - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? undefined : date;
      }
      return undefined;
    };

    const parseNumber = (value: any): number => {
      if (value === null || value === undefined || value === '') return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        let cleaned = value.replace(/[R$\s]/g, '').trim();
        if (cleaned.includes(',') && cleaned.includes('.')) {
          const lastComma = cleaned.lastIndexOf(',');
          const lastDot = cleaned.lastIndexOf('.');
          if (lastComma > lastDot) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          } else {
            cleaned = cleaned.replace(/,/g, '');
          }
        } else if (cleaned.includes(',')) {
          cleaned = cleaned.replace(',', '.');
        }
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    const parsePercentage = (value: any): number | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      if (typeof value === 'string') {
        const cleaned = value.replace('%', '').replace(',', '.').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? undefined : num;
      }
      if (typeof value === 'number') {
        return value < 1 && value > -1 ? value * 100 : value;
      }
      return undefined;
    };

    // Campos obrigatórios
    const orderId = getValue(columnMap.orderId);
    if (!orderId) {
      console.warn(`[TikTokParser] Linha ${rowIndex + 1}: Order ID não encontrado`);
      return null;
    }

    const orderDate = parseDate(getValue(columnMap.orderDate));
    if (!orderDate) {
      console.warn(`[TikTokParser] Linha ${rowIndex + 1}: Data do pedido inválida`);
      return null;
    }

    // Campos financeiros
    const orderValue = parseNumber(getValue(columnMap.orderValue));
    const revenue = parseNumber(getValue(columnMap.revenue)) || orderValue;
    const productSales = parseNumber(getValue(columnMap.productSales));
    const commissions = parseNumber(getValue(columnMap.commissions));
    const transactionFee = parseNumber(getValue(columnMap.transactionFee));
    const shippingFee = parseNumber(getValue(columnMap.shippingFee));
    const otherPlatformFees = parseNumber(getValue(columnMap.otherPlatformFees));
    const platformDiscount = parseNumber(getValue(columnMap.platformDiscount));
    const refunds = parseNumber(getValue(columnMap.refunds));
    const productCost = parseNumber(getValue(columnMap.productCost));

    // Lucro e Margem - usa valores da planilha diretamente
    const profit = parseNumber(getValue(columnMap.profit));
    const profitMargin = parsePercentage(getValue(columnMap.profitMargin));

    // Log para debug dos primeiros pedidos
    if (rowIndex <= 3) {
      console.log(`[TikTokParser] Linha ${rowIndex + 1}: orderValue=${orderValue}, revenue=${revenue}, profit=${profit}, profitMargin=${profitMargin}`);
    }

    return {
      platform_order_id: String(orderId),
      external_order_id: getValue(columnMap.externalOrderId) ? String(getValue(columnMap.externalOrderId)) : undefined,
      platform_name: getValue(columnMap.platformName) ? String(getValue(columnMap.platformName)) : 'TikTok',
      store_name: getValue(columnMap.storeName) ? String(getValue(columnMap.storeName)) : undefined,
      order_date: orderDate,
      settlement_date: parseDate(getValue(columnMap.settlementDate)),
      sku: getValue(columnMap.sku) ? String(getValue(columnMap.sku)).replace(/\r?\n/g, ' ').trim() : 'N/A',
      quantity: parseNumber(getValue(columnMap.quantity)) || 1,
      order_value: orderValue,
      revenue: revenue,
      product_sales: productSales || undefined,
      shipping_fee_buyer: undefined,
      platform_discount: platformDiscount || undefined,
      commissions: commissions || undefined,
      transaction_fee: transactionFee || undefined,
      shipping_fee: shippingFee || undefined,
      other_platform_fees: otherPlatformFees || undefined,
      refunds: refunds > 0 ? refunds : undefined,
      product_cost: productCost || undefined,
      profit: profit || undefined,
      profit_margin: profitMargin,
    };
  }
}

export default new TikTokParser();
