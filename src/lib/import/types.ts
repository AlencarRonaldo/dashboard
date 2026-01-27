// Estrutura de dados normalizada para um único pedido
export interface NormalizedOrder {
  platform_order_id: string;
  order_date: Date;
  settlement_date?: Date;
  sku: string;
  quantity: number;
  // Valores financeiros
  order_value: number;
  revenue?: number;
  product_sales?: number;
  commissions?: number;
  fees?: number;
  refunds?: number;
  product_cost?: number;
  profit?: number;
  profit_margin?: number;
}

// Contrato que cada parser de marketplace deve seguir
export interface MarketplaceParser {
  // Tenta analisar o conteúdo de uma planilha
  // Se for bem-sucedido, retorna os dados normalizados
  // Se não for o formato esperado, retorna null
  parse: (rows: any[][]) => NormalizedOrder[] | null;
}

// Tipos de marketplace que a aplicação suporta
export type MarketplaceName = 'meli' | 'shopee' | 'shein' | 'tiktok';
