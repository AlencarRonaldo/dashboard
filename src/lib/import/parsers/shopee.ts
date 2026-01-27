import { MarketplaceParser, NormalizedOrder } from '../types';

class ShopeeParser implements MarketplaceParser {
  parse(rows: any[][]): NormalizedOrder[] | null {
    if (rows.length < 2) return null;
    const headerRow = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
    const isShopee = this.isShopeeSheet(headerRow);
    if (!isShopee) return null;
    console.log('Parser da Shopee acionado.');
    const columnMap = this.mapColumns(headerRow);
    if (!columnMap.orderId || !columnMap.orderDate) {
      console.warn('Colunas obrigatórias não encontradas na planilha da Shopee');
      return null;
    }
    const normalizedOrders: NormalizedOrder[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      try {
        const order = this.parseRow(row, columnMap);
        if (order) normalizedOrders.push(order);
      } catch (error) {
        console.warn(`Erro ao processar linha ${i + 1} da Shopee:`, error);
        continue;
      }
    }
    return normalizedOrders.length > 0 ? normalizedOrders : null;
  }

  private isShopeeSheet(headerRow: string[]): boolean {
    const shopeeIndicators = [
      'order id', 'orderid', 'id do pedido', 'pedido', 'shopee', 
      'order sn', 'ordersn', 'order_sn', 'order_sn', 'número do pedido',
      'numero do pedido', 'nº do pedido'
    ];
    const headerText = headerRow.join(' ').toLowerCase();
    const hasIndicator = shopeeIndicators.some(indicator => headerText.includes(indicator.toLowerCase()));
    
    const hasOrderColumn = headerRow.some(h => {
      const hLower = String(h || '').toLowerCase();
      return (
        (hLower.includes('order') && hLower.includes('id')) ||
        (hLower.includes('pedido') && (hLower.includes('id') || hLower.includes('nº') || hLower.includes('numero'))) ||
        hLower.includes('order sn') ||
        hLower.includes('order_sn')
      );
    });
    
    const hasDateColumn = headerRow.some(h => {
      const hLower = String(h || '').toLowerCase();
      return hLower.includes('date') || hLower.includes('data') || hLower.includes('time') || hLower.includes('criação');
    });
    
    const hasShopeeColumns = hasOrderColumn && hasDateColumn;
    
    const result = hasIndicator || hasShopeeColumns;
    
    if (!result) {
      console.log('[ShopeeParser] Não identificado. Verificações:');
      console.log('  - Indicadores encontrados:', hasIndicator);
      console.log('  - Coluna de pedido encontrada:', hasOrderColumn);
      console.log('  - Coluna de data encontrada:', hasDateColumn);
    }
    
    return result;
  }

  private mapColumns(headerRow: string[]): any {
    const map: any = {};
    headerRow.forEach((header, index) => {
      const h = header.toLowerCase();
      if (!map.orderId && (h.includes('order id') || h.includes('orderid') || h.includes('id do pedido') || h.includes('pedido id'))) map.orderId = index;
      if (!map.orderDate && (h.includes('order date') || h.includes('data do pedido') || h.includes('data de criação') || h.includes('create time') || h.includes('order time') || (h.includes('data') && h.includes('pedido')))) map.orderDate = index;
      if (!map.settlementDate && (h.includes('settlement') || h.includes('liquidação') || h.includes('data de liquidação'))) map.settlementDate = index;
      if (!map.sku && (h.includes('sku') || h.includes('product sku') || h.includes('código'))) map.sku = index;
      if (!map.quantity && (h.includes('quantity') || h.includes('quantidade') || h.includes('qty'))) map.quantity = index;
      if (!map.orderValue && (h.includes('order value') || h.includes('valor do pedido') || h.includes('total') || h.includes('amount') || h.includes('valor total') || h.includes('faturamento') || h.includes('revenue'))) map.orderValue = index;
      if (!map.revenue && (h.includes('revenue') || h.includes('receita') || h.includes('receita líquida'))) map.revenue = index;
      if (!map.productSales && (h.includes('product sales') || h.includes('vendas do produto'))) map.productSales = index;
      if (!map.commissions && (h.includes('commission') || h.includes('comissão') || h.includes('comissões'))) map.commissions = index;
      if (!map.fees && (h.includes('fee') || h.includes('taxa') || h.includes('taxas') || h.includes('transaction fee') || h.includes('taxa de transação'))) map.fees = index;
      if (!map.refunds && (h.includes('refund') || h.includes('reembolso') || h.includes('reembolsos'))) map.refunds = index;
      if (!map.productCost && (h.includes('cost') || h.includes('custo') || h.includes('product cost') || h.includes('custo do produto') || h.includes('custo unitário'))) map.productCost = index;
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

export default new ShopeeParser();
