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
    
    if (!columnMap.orderId || !columnMap.orderDate) {
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
        const order = this.parseRow(row, columnMap);
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
    const sheinIndicators = ['order no', 'orderno', 'order number', 'shein', 'order id', 'pedido'];
    const headerText = headerRow.join(' ').toLowerCase();
    const hasIndicator = sheinIndicators.some(indicator => headerText.includes(indicator));
    const hasSheinColumns = 
      (headerRow.some(h => (h.includes('order') && (h.includes('no') || h.includes('number') || h.includes('id'))) || h.includes('order no'))) &&
      (headerRow.some(h => h.includes('time') || h.includes('date') || h.includes('data')));
    return hasIndicator || hasSheinColumns;
  }

  private mapColumns(headerRow: string[]): any {
    const map: any = {};
    headerRow.forEach((header, index) => {
      const h = header.toLowerCase().trim();
      
      // Order ID - várias variações
      if (!map.orderId && (
        h === 'order no' || 
        h === 'orderno' || 
        h.includes('order no') || 
        h.includes('order number') || 
        h.includes('order id') || 
        h.includes('orderid') || 
        h.includes('id do pedido') || 
        h.includes('pedido id') ||
        h === 'order_id'
      )) {
        map.orderId = index;
        console.log(`[SheinParser] ✅ Order ID mapeado para coluna ${index}: "${header}"`);
      }
      
      // Order Date - várias variações
      if (!map.orderDate && (
        h.includes('order time') || 
        h.includes('order date') || 
        h.includes('data do pedido') || 
        h.includes('data de criação') || 
        h.includes('create time') || 
        (h.includes('data') && h.includes('order')) ||
        (h.includes('time') && h.includes('order')) ||
        h === 'order_date' ||
        h === 'order_time'
      )) {
        map.orderDate = index;
        console.log(`[SheinParser] ✅ Order Date mapeado para coluna ${index}: "${header}"`);
      }
      
      // Settlement Date
      if (!map.settlementDate && (
        h.includes('settlement') || 
        h.includes('liquidação') || 
        h.includes('data de liquidação')
      )) {
        map.settlementDate = index;
      }
      
      // SKU
      if (!map.sku && (
        h.includes('sku') || 
        h.includes('product sku') || 
        h.includes('código') || 
        h.includes('item id') || 
        h.includes('product id')
      )) {
        map.sku = index;
      }
      
      // Quantity
      if (!map.quantity && (
        h.includes('quantity') || 
        h.includes('quantidade') || 
        h.includes('qty')
      )) {
        map.quantity = index;
      }
      
      // Order Value
      if (!map.orderValue && (
        h.includes('order value') || 
        h.includes('valor do pedido') || 
        (h.includes('total') && !h.includes('revenue')) || 
        h.includes('amount') || 
        h.includes('valor total') || 
        h.includes('faturamento') || 
        (h.includes('revenue') && !h.includes('product')) || 
        h.includes('price')
      )) {
        map.orderValue = index;
      }
      
      // Revenue
      if (!map.revenue && (
        h.includes('revenue') || 
        h.includes('receita') || 
        h.includes('receita líquida')
      )) {
        map.revenue = index;
      }
      
      // Product Sales
      if (!map.productSales && (
        h.includes('product sales') || 
        h.includes('vendas do produto')
      )) {
        map.productSales = index;
      }
      
      // Commissions
      if (!map.commissions && (
        h.includes('commission') || 
        h.includes('comissão') || 
        h.includes('comissões')
      )) {
        map.commissions = index;
      }
      
      // Fees
      if (!map.fees && (
        h.includes('fee') || 
        h.includes('taxa') || 
        h.includes('taxas') || 
        h.includes('transaction fee') || 
        h.includes('taxa de transação')
      )) {
        map.fees = index;
      }
      
      // Refunds
      if (!map.refunds && (
        h.includes('refund') || 
        h.includes('reembolso') || 
        h.includes('reembolsos')
      )) {
        map.refunds = index;
      }
      
      // Product Cost
      if (!map.productCost && (
        h.includes('cost') || 
        h.includes('custo') || 
        h.includes('product cost') || 
        h.includes('custo do produto') || 
        h.includes('custo unitário')
      )) {
        map.productCost = index;
      }
    });
    
    return map;
  }

  private parseRow(row: any[], columnMap: any): NormalizedOrder | null {
    const getValue = (index?: number) => index !== undefined && row[index] ? row[index] : undefined;
    const parseDate = (value: any): Date | undefined => {
      if (!value) return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? undefined : date;
      }
      if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? undefined : date;
      }
      return undefined;
    };
    const parseNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[R$\s.,]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    const orderId = getValue(columnMap.orderId);
    if (!orderId) return null;
    const orderDate = parseDate(getValue(columnMap.orderDate));
    if (!orderDate) return null;

    const sku = getValue(columnMap.sku) || 'N/A';
    const quantity = parseNumber(getValue(columnMap.quantity)) || 1;
    const orderValue = parseNumber(getValue(columnMap.orderValue));
    const revenue = parseNumber(getValue(columnMap.revenue)) || orderValue;
    const productSales = parseNumber(getValue(columnMap.productSales));
    const commissions = parseNumber(getValue(columnMap.commissions));
    const fees = parseNumber(getValue(columnMap.fees));
    const refunds = parseNumber(getValue(columnMap.refunds)) || 0;
    const productCost = parseNumber(getValue(columnMap.productCost));
    
    let profit: number | undefined;
    let profitMargin: number | undefined;
    if (productCost !== undefined && revenue !== undefined) {
      profit = revenue - productCost - (commissions || 0) - (fees || 0) - (refunds || 0);
      profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    }

    return {
      platform_order_id: String(orderId),
      order_date: orderDate,
      settlement_date: parseDate(getValue(columnMap.settlementDate)),
      sku: String(sku),
      quantity,
      order_value: orderValue,
      revenue,
      product_sales: productSales || undefined,
      commissions: commissions || undefined,
      fees: fees || undefined,
      refunds: refunds > 0 ? refunds : undefined,
      product_cost: productCost || undefined,
      profit,
      profit_margin: profitMargin,
    };
  }
}

export default new SheinParser();
