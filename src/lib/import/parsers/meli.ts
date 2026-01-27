import { MarketplaceParser, NormalizedOrder } from '../types';

class MeliParser implements MarketplaceParser {
  parse(rows: any[][]): NormalizedOrder[] | null {
    if (rows.length < 2) return null;

    const headerRow = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
    const isMeli = this.isMeliSheet(headerRow);
    if (!isMeli) return null;

    console.log('Parser do Mercado Livre acionado.');
    const columnMap = this.mapColumns(headerRow);
    if (!columnMap.orderId || !columnMap.orderDate) {
      console.warn('Colunas obrigatórias não encontradas na planilha do MELI');
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
        console.warn(`Erro ao processar linha ${i + 1} do MELI:`, error);
        continue;
      }
    }
    return normalizedOrders.length > 0 ? normalizedOrders : null;
  }

  private isMeliSheet(headerRow: string[]): boolean {
    const meliIndicators = [
      'nº de venda', 'numero de venda', 'n° de venda', 'número de venda',
      'venda', 'mercado livre', 'meli', 'ml-', 'order id', 'orderid',
      'id da venda', 'id venda', 'venda id', 'pedido ml'
    ];
    const headerText = headerRow.join(' ').toLowerCase();
    const hasIndicator = meliIndicators.some(indicator => headerText.includes(indicator.toLowerCase()));
    
    const hasMeliOrderColumn = headerRow.some(h => {
      const hLower = String(h || '').toLowerCase();
      return (
        (hLower.includes('venda') || hLower.includes('pedido')) && 
        (hLower.includes('nº') || hLower.includes('numero') || hLower.includes('número') || hLower.includes('id')) ||
        hLower.includes('ml-') ||
        (hLower.includes('order') && hLower.includes('id'))
      );
    });
    
    const hasDateColumn = headerRow.some(h => {
      const hLower = String(h || '').toLowerCase();
      return hLower.includes('data') || hLower.includes('date') || hLower.includes('time');
    });
    
    const hasMeliColumns = hasMeliOrderColumn && hasDateColumn;
    
    const result = hasIndicator || hasMeliColumns;
    
    if (!result) {
      console.log('[MeliParser] Não identificado. Verificações:');
      console.log('  - Indicadores encontrados:', hasIndicator);
      console.log('  - Coluna de venda encontrada:', hasMeliOrderColumn);
      console.log('  - Coluna de data encontrada:', hasDateColumn);
    }
    
    return result;
  }

  private mapColumns(headerRow: string[]): any {
    const map: any = {};
    headerRow.forEach((header, index) => {
      const h = header.toLowerCase();
      if (!map.orderId && (h.includes('nº de venda') || h.includes('numero de venda') || h.includes('n° de venda') || (h.includes('venda') && h.includes('nº')) || h.includes('order id') || h.includes('id do pedido') || h.includes('pedido id') || h.startsWith('ml-'))) map.orderId = index;
      if (!map.orderDate && (h.includes('data de venda') || h.includes('data do pedido') || h.includes('order date') || (h.includes('data') && (h.includes('venda') || h.includes('pedido'))) || h.includes('fecha') || h.includes('date'))) map.orderDate = index;
      if (!map.settlementDate && (h.includes('liquidação') || h.includes('liquidacao') || h.includes('data de liquidação') || h.includes('settlement'))) map.settlementDate = index;
      if (!map.sku && (h.includes('sku') || h.includes('código') || h.includes('codigo') || h.includes('product sku') || h.includes('item id'))) map.sku = index;
      if (!map.quantity && (h.includes('quantidade') || h.includes('quantity') || h.includes('qty') || h.includes('cantidad'))) map.quantity = index;
      if (!map.orderValue && (h.includes('valor da venda') || h.includes('valor do pedido') || h.includes('total') || h.includes('amount') || h.includes('valor total') || h.includes('faturamento') || h.includes('revenue') || h.includes('precio') || h.includes('preço'))) map.orderValue = index;
      if (!map.revenue && (h.includes('receita') || h.includes('receita líquida') || h.includes('revenue'))) map.revenue = index;
      if (!map.productSales && (h.includes('vendas do produto') || h.includes('product sales'))) map.productSales = index;
      if (!map.commissions && (h.includes('comissão') || h.includes('comissao') || h.includes('commission') || h.includes('comisiones'))) map.commissions = index;
      if (!map.fees && (h.includes('taxa') || h.includes('taxas') || h.includes('fee') || h.includes('transaction fee') || h.includes('taxa de transação') || h.includes('costo de envío') || h.includes('frete'))) map.fees = index;
      if (!map.refunds && (h.includes('reembolso') || h.includes('reembolsos') || h.includes('refund'))) map.refunds = index;
      if (!map.productCost && (h.includes('custo') || h.includes('cost') || h.includes('product cost') || h.includes('custo do produto') || h.includes('costo del producto'))) map.productCost = index;
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

export default new MeliParser();
