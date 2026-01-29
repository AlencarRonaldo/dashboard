import { MarketplaceParser, NormalizedOrder } from '../types';

class SheinParser implements MarketplaceParser {
  parse(rows: any[][]): NormalizedOrder[] | null {
    if (rows.length < 2) {
      console.log('[SheinParser] Planilha tem menos de 2 linhas');
      return null;
    }

    const headerRow = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
    console.log('[SheinParser] Cabeçalho detectado:', headerRow);

    const isShein = this.isSheinSheet(headerRow);
    if (!isShein) {
      console.log('[SheinParser] Planilha não identificada como Shein');
      return null;
    }

    console.log('[SheinParser] ✅ Planilha identificada como Shein');
    const columnMap = this.mapColumns(headerRow);
    console.log('[SheinParser] Mapeamento de colunas:', columnMap);

    if (columnMap.orderId === undefined || columnMap.orderDate === undefined) {
      console.warn('[SheinParser] ❌ Colunas obrigatórias não encontradas');
      console.warn('[SheinParser] orderId:', columnMap.orderId, 'orderDate:', columnMap.orderDate);
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
        console.warn(`[SheinParser] Erro ao processar linha ${i + 1}:`, error.message);
        skippedRows++;
        continue;
      }
    }

    console.log(`[SheinParser] ✅ Processamento concluído: ${normalizedOrders.length} pedidos normalizados, ${skippedRows} linhas ignoradas`);
    return normalizedOrders.length > 0 ? normalizedOrders : null;
  }

  private isSheinSheet(headerRow: string[]): boolean {
    const headerText = headerRow.join(' ').toLowerCase();

    // IMPORTANTE: Verifica primeiro se NÃO é de outro marketplace
    const otherMarketplaceIndicators = [
      'tiktok',
      'tik tok',
      'descontos sobre vendas',  // TikTok específico
      'taxa de serviço',         // TikTok (sem "de envio")
      'ajustes',                 // TikTok
      'imposto',                 // TikTok
      'mercado',
      'shopee'
    ];

    // Verifica se tem indicador de TikTok (exceto se também tiver de Shein)
    const isTikTok = otherMarketplaceIndicators.some(ind => headerText.includes(ind));
    const hasSheinSpecific = headerText.includes('valor de liquidação') ||
                             headerText.includes('comissão de vendas') ||
                             headerText.includes('taxa de serviço de envio');

    if (isTikTok && !hasSheinSpecific) {
      console.log('[SheinParser] Detectado como outro marketplace, não Shein');
      return false;
    }

    // Indicadores específicos da Shein
    const sheinIndicators = [
      'shein',
      'valor de liquidação',
      'comissão de vendas',
      'taxa de serviço de envio'
    ];

    const hasSheinIndicator = sheinIndicators.some(ind => headerText.includes(ind));

    if (!hasSheinIndicator) {
      console.log('[SheinParser] Não identificado como Shein. Texto do cabeçalho:', headerText.substring(0, 300));
    }

    return hasSheinIndicator;
  }

  private mapColumns(headerRow: string[]): any {
    const map: any = {};

    headerRow.forEach((header, index) => {
      const h = header.toLowerCase().trim().replace(/\r?\n/g, ' ');

      // Order ID - Nº de Pedido de Plataforma
      if (map.orderId === undefined && (
        h.includes('nº de pedido de plataforma') ||
        h.includes('numero de pedido de plataforma') ||
        h.includes('order no') ||
        h.includes('order number') ||
        h.includes('order id') ||
        h === 'pedido'
      )) {
        map.orderId = index;
        console.log(`[SheinParser] ✅ Order ID: coluna ${index} "${header}"`);
      }

      // External Order ID - Nº de Pedido de UpSeller
      if (map.externalOrderId === undefined && (
        h.includes('nº de pedido de upseller') ||
        h.includes('numero de pedido de upseller') ||
        h.includes('upseller')
      )) {
        map.externalOrderId = index;
        console.log(`[SheinParser] ✅ External Order ID: coluna ${index} "${header}"`);
      }

      // Order Date - Ordenado
      if (map.orderDate === undefined && (
        h === 'ordenado' ||
        h.includes('order date') ||
        h.includes('order time') ||
        h.includes('data do pedido') ||
        h.includes('data de criação')
      )) {
        map.orderDate = index;
        console.log(`[SheinParser] ✅ Order Date: coluna ${index} "${header}"`);
      }

      // Settlement Date - Liquidação
      if (map.settlementDate === undefined && (
        h === 'liquidação' ||
        h.includes('settlement') ||
        h.includes('data de liquidação')
      )) {
        map.settlementDate = index;
        console.log(`[SheinParser] ✅ Settlement Date: coluna ${index} "${header}"`);
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
        h.includes('valor total')
      )) {
        map.orderValue = index;
        console.log(`[SheinParser] ✅ Order Value: coluna ${index} "${header}"`);
      }

      // Revenue - Valor de Liquidação (receita líquida)
      if (map.revenue === undefined && (
        h === 'valor de liquidação' ||
        h.includes('settlement amount') ||
        h.includes('receita líquida')
      )) {
        map.revenue = index;
        console.log(`[SheinParser] ✅ Revenue: coluna ${index} "${header}"`);
      }

      // Product Sales - Vendas de Produtos
      if (map.productSales === undefined && (
        h === 'vendas de produtos' ||
        h.includes('product sales') ||
        h.includes('vendas do produto')
      )) {
        map.productSales = index;
        console.log(`[SheinParser] ✅ Product Sales: coluna ${index} "${header}"`);
      }

      // Other Revenue - Outras Receitas
      if (map.otherRevenue === undefined && (
        h === 'outras receitas' ||
        h.includes('other revenue')
      )) {
        map.otherRevenue = index;
      }

      // Commissions - Comissão de Vendas
      if (map.commissions === undefined && (
        h === 'comissão de vendas' ||
        h.includes('comissão') ||
        h.includes('commission') ||
        h.includes('sales commission')
      )) {
        map.commissions = index;
        console.log(`[SheinParser] ✅ Commissions: coluna ${index} "${header}"`);
      }

      // Platform Discount - Descontos e Cupons
      if (map.platformDiscount === undefined && (
        h === 'descontos e cupons' ||
        h.includes('discount') ||
        h.includes('cupons') ||
        h.includes('desconto')
      )) {
        map.platformDiscount = index;
        console.log(`[SheinParser] ✅ Platform Discount: coluna ${index} "${header}"`);
      }

      // Shipping Fee - Taxa de Serviço de Envio
      if (map.shippingFee === undefined && (
        h === 'taxa de serviço de envio' ||
        h.includes('shipping fee') ||
        h.includes('taxa de envio') ||
        h.includes('frete')
      )) {
        map.shippingFee = index;
        console.log(`[SheinParser] ✅ Shipping Fee: coluna ${index} "${header}"`);
      }

      // Other Costs - Outros Custos
      if (map.otherCosts === undefined && (
        h === 'outros custos' ||
        h.includes('other costs') ||
        h.includes('outras taxas')
      )) {
        map.otherCosts = index;
        console.log(`[SheinParser] ✅ Other Costs: coluna ${index} "${header}"`);
      }

      // Refunds - Reembolso
      if (map.refunds === undefined && (
        h === 'reembolso' ||
        h.includes('refund') ||
        h.includes('reembolsos')
      )) {
        map.refunds = index;
        console.log(`[SheinParser] ✅ Refunds: coluna ${index} "${header}"`);
      }

      // SKU - SKU Mapeado
      if (map.sku === undefined && (
        h.includes('sku mapeado') ||
        h.includes('sku') ||
        h.includes('product sku') ||
        h.includes('código')
      )) {
        map.sku = index;
        console.log(`[SheinParser] ✅ SKU: coluna ${index} "${header}"`);
      }

      // Quantity - Qty. do Anúncio
      if (map.quantity === undefined && (
        h.includes('qty') ||
        h.includes('quantity') ||
        h.includes('quantidade') ||
        h.includes('anúncio')
      )) {
        map.quantity = index;
        console.log(`[SheinParser] ✅ Quantity: coluna ${index} "${header}"`);
      }

      // Product Cost - Custo do Produto
      if (map.productCost === undefined && (
        h === 'custo do produto' ||
        h.includes('product cost') ||
        h.includes('custo unitário')
      )) {
        map.productCost = index;
        console.log(`[SheinParser] ✅ Product Cost: coluna ${index} "${header}"`);
      }

      // Profit - Lucro
      if (map.profit === undefined && (
        h === 'lucro' ||
        h === 'profit'
      )) {
        map.profit = index;
        console.log(`[SheinParser] ✅ Profit: coluna ${index} "${header}"`);
      }

      // Profit Margin - Margem de Lucro
      if (map.profitMargin === undefined && (
        h === 'margem de lucro' ||
        h.includes('profit margin') ||
        h.includes('margem')
      )) {
        map.profitMargin = index;
        console.log(`[SheinParser] ✅ Profit Margin: coluna ${index} "${header}"`);
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
        // Tenta vários formatos
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
        // Remove símbolos de moeda e espaços
        let cleaned = value.replace(/[R$\s]/g, '').trim();
        // Trata formato brasileiro (1.234,56) vs americano (1,234.56)
        if (cleaned.includes(',') && cleaned.includes('.')) {
          // Se tem ambos, verifica qual é o separador decimal
          const lastComma = cleaned.lastIndexOf(',');
          const lastDot = cleaned.lastIndexOf('.');
          if (lastComma > lastDot) {
            // Formato brasileiro: 1.234,56
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          } else {
            // Formato americano: 1,234.56
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
        // Se for menor que 1, assume que é decimal (0.75 = 75%)
        return value < 1 && value > -1 ? value * 100 : value;
      }
      return undefined;
    };

    // Campos obrigatórios
    const orderId = getValue(columnMap.orderId);
    if (!orderId) {
      console.warn(`[SheinParser] Linha ${rowIndex + 1}: Order ID não encontrado`);
      return null;
    }

    const orderDate = parseDate(getValue(columnMap.orderDate));
    if (!orderDate) {
      console.warn(`[SheinParser] Linha ${rowIndex + 1}: Data do pedido inválida`);
      return null;
    }

    // Campos financeiros
    const orderValue = parseNumber(getValue(columnMap.orderValue));
    const revenue = parseNumber(getValue(columnMap.revenue)) || orderValue;
    const productSales = parseNumber(getValue(columnMap.productSales));
    const commissions = parseNumber(getValue(columnMap.commissions));
    const shippingFee = parseNumber(getValue(columnMap.shippingFee));
    const otherCosts = parseNumber(getValue(columnMap.otherCosts));
    const platformDiscount = parseNumber(getValue(columnMap.platformDiscount));
    const refunds = parseNumber(getValue(columnMap.refunds));
    const productCost = parseNumber(getValue(columnMap.productCost));

    // Lucro e Margem - usa valores da planilha diretamente
    const profit = parseNumber(getValue(columnMap.profit));
    const profitMargin = parsePercentage(getValue(columnMap.profitMargin));

    // Log para debug dos primeiros pedidos
    if (rowIndex <= 3) {
      console.log(`[SheinParser] Linha ${rowIndex + 1}: orderValue=${orderValue}, revenue=${revenue}, profit=${profit}, profitMargin=${profitMargin}`);
    }

    return {
      platform_order_id: String(orderId),
      external_order_id: getValue(columnMap.externalOrderId) ? String(getValue(columnMap.externalOrderId)) : undefined,
      platform_name: getValue(columnMap.platformName) ? String(getValue(columnMap.platformName)) : 'Shein',
      store_name: getValue(columnMap.storeName) ? String(getValue(columnMap.storeName)) : undefined,
      order_date: orderDate,
      settlement_date: parseDate(getValue(columnMap.settlementDate)),
      sku: getValue(columnMap.sku) ? String(getValue(columnMap.sku)).replace(/\r?\n/g, ' ').trim() : 'N/A',
      quantity: parseNumber(getValue(columnMap.quantity)) || 1,
      order_value: orderValue,
      revenue: revenue,
      product_sales: productSales || undefined,
      shipping_fee_buyer: undefined, // Shein não tem este campo
      platform_discount: platformDiscount || undefined,
      commissions: commissions || undefined,
      transaction_fee: undefined, // Shein não tem este campo separado
      shipping_fee: shippingFee || undefined,
      other_platform_fees: otherCosts || undefined,
      refunds: refunds > 0 ? refunds : undefined,
      product_cost: productCost || undefined,
      profit: profit || undefined,
      profit_margin: profitMargin,
    };
  }
}

export default new SheinParser();
