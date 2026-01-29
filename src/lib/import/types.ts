// Estrutura de dados normalizada para um único pedido
export interface NormalizedOrder {
  platform_order_id: string;
  external_order_id?: string;       // ID em sistema externo (UpSeller, Bling, etc)
  platform_name?: string;           // Nome da plataforma (ex: "Mercado")
  store_name?: string;              // Nome da loja conforme planilha
  order_date: Date;
  settlement_date?: Date;
  sku: string;
  quantity: number;

  // Valores financeiros básicos
  order_value: number;
  revenue?: number;
  product_sales?: number;

  // Taxas detalhadas (novos campos)
  shipping_fee_buyer?: number;      // Frete pago pelo comprador
  platform_discount?: number;       // Desconto/subsídio da plataforma
  commissions?: number;             // Comissão do marketplace
  transaction_fee?: number;         // Taxa de transação
  shipping_fee?: number;            // Taxa de frete (custo vendedor)
  other_platform_fees?: number;     // Outras taxas da plataforma

  // Campo legado (soma de todas as taxas exceto comissões)
  total_fees?: number;

  // Outros campos financeiros
  refunds?: number;
  product_cost?: number;
  profit?: number;
  profit_margin?: number;
}

// Resultado do parsing de uma linha individual
export interface ParsedRowResult {
  success: boolean;
  order?: NormalizedOrder;
  rowNumber: number;
  errorMessage?: string;
  warningMessage?: string;
  rawData: Record<string, any>;
}

// Resultado completo do parsing
export interface ParseResult {
  orders: NormalizedOrder[];
  rowResults: ParsedRowResult[];
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
}

// Contrato que cada parser de marketplace deve seguir
export interface MarketplaceParser {
  // Nome do marketplace para identificação (opcional)
  name?: MarketplaceName;

  // Detecta se a planilha é deste marketplace (opcional)
  detect?: (headerRow: string[]) => boolean;

  // Tenta analisar o conteúdo de uma planilha
  // Se for bem-sucedido, retorna os dados normalizados
  // Se não for o formato esperado, retorna null
  parse: (rows: any[][]) => NormalizedOrder[] | null;

  // Parsing detalhado com logs por linha (opcional)
  parseWithLogs?: (rows: any[][]) => ParseResult | null;
}

// Tipos de marketplace que a aplicação suporta
export type MarketplaceName = 'meli' | 'shopee' | 'shein' | 'tiktok' | 'amazon' | 'magalu';

// Mapeamento de colunas
export interface ColumnMapping {
  sourceColumn: string;
  targetField: keyof NormalizedOrder;
  index: number;
  transform?: (value: any) => any;
}

// Dicionário de sinônimos para detecção inteligente de colunas
export const COLUMN_SYNONYMS: Record<string, string[]> = {
  // Data do Pedido
  orderDate: [
    'ordenado', 'order date', 'data do pedido', 'data de venda',
    'fecha', 'date', 'data_pedido', 'dt_pedido', 'created_at',
    'data da venda', 'data venda', 'dt_venda', 'data', 'time'
  ],

  // Data de Liquidação
  settlementDate: [
    'liquidação', 'liquidacao', 'settlement', 'settlement date',
    'data liquidação', 'data liquidacao', 'dt_liquidacao',
    'data de pagamento', 'payment date', 'data de liquidação'
  ],

  // ID do Pedido (Plataforma)
  platformOrderId: [
    'nº de pedido de plataforma', 'order id', 'pedido id', 'id pedido',
    'nº de venda', 'numero de venda', 'n° de venda', 'order number',
    'número do pedido', 'numero do pedido', 'cod_pedido', 'cod pedido',
    'id do pedido', 'pedido', 'sale id', 'venda id', 'nº pedido plataforma',
    'número de venda', 'orderid', 'id da venda', 'id venda', 'venda id', 'pedido ml',
    'id mercado livre', 'id ml', 'pedido mercado livre', 'mlb', 'order ml',
    'nº venda ml', 'numero venda ml', 'id shopee', 'pedido shopee'
  ],

  // ID Externo (Sistema de Gestão)
  externalOrderId: [
    'nº de pedido de upseller', 'external id', 'id externo',
    'ref', 'referência', 'referencia', 'código externo',
    'erp id', 'system id', 'id sistema', 'nº pedido upseller'
  ],

  // SKU
  sku: [
    'sku mapeado', 'sku', 'código', 'codigo', 'product sku',
    'item id', 'cod_produto', 'código do produto', 'product code',
    'sku do produto', 'sku produto', 'cod sku', 'ref produto'
  ],

  // Quantidade
  quantity: [
    'qty. do anúncio', 'quantidade', 'quantity', 'qty',
    'qtd', 'qtde', 'quant', 'unidades', 'units', 'qty.',
    'qtd. do anúncio', 'quantidade vendida', 'cantidad'
  ],

  // Valor do Pedido
  orderValue: [
    'valor do pedido', 'order value', 'valor total', 'total',
    'amount', 'valor da venda', 'sale value', 'gmv',
    'valor bruto', 'gross value', 'preço', 'precio', 'faturamento'
  ],

  // Receita
  revenue: [
    'receita', 'revenue', 'net revenue', 'receita líquida',
    'valor líquido', 'net value', 'receita final', 'valor de liquidação'
  ],

  // Vendas de Produtos
  productSales: [
    'vendas de produtos', 'product sales', 'vendas do produto',
    'venda produto', 'sales'
  ],

  // Frete pago pelo comprador
  shippingFeeBuyer: [
    'taxa de frete paga pelo comprador', 'frete comprador',
    'shipping fee buyer', 'buyer shipping', 'frete cliente'
  ],

  // Desconto/Subsídio da plataforma
  platformDiscount: [
    'desconto e subsídio da plataforma', 'desconto plataforma',
    'platform discount', 'subsídio', 'desconto', 'discount'
  ],

  // Comissão
  commissions: [
    'comissão', 'comissao', 'commission', 'comisiones',
    'taxa comissão', 'marketplace fee', 'seller fee'
  ],

  // Taxa de transação
  transactionFee: [
    'taxa de transação', 'transaction fee', 'taxa transação',
    'processing fee', 'taxa de transacao'
  ],

  // Taxa de frete (custo)
  shippingFee: [
    'taxa do frete', 'shipping fee', 'taxa frete',
    'frete vendedor', 'seller shipping', 'taxa de frete'
  ],

  // Outras taxas
  otherPlatformFees: [
    'outra taxa da plataforma', 'other fees', 'outras taxas',
    'other platform fees', 'taxa adicional'
  ],

  // Reembolso
  refunds: [
    'reembolso do comprador', 'reembolso', 'refund', 'refunds',
    'devolução', 'devoluções', 'chargebacks', 'reembolsos'
  ],

  // Custo do Produto
  productCost: [
    'custo do produto', 'product cost', 'custo', 'cost',
    'costo', 'custo unitário', 'unit cost', 'cogs'
  ],

  // Lucro
  profit: [
    'lucro', 'profit', 'ganho', 'resultado',
    'lucro líquido', 'net profit'
  ],

  // Margem de Lucro
  profitMargin: [
    'margem de lucro', 'profit margin', 'margem', 'margin',
    '% lucro', 'percentual lucro', 'rentabilidade'
  ],

  // Loja
  storeName: [
    'loja', 'store', 'seller', 'vendedor', 'shop',
    'conta', 'account', 'seller name', 'nome loja'
  ],

  // Plataforma
  platformName: [
    'plataforma', 'platform', 'marketplace', 'canal',
    'channel', 'origem', 'source'
  ]
};

/**
 * Normaliza um cabeçalho para comparação
 */
export function normalizeHeader(header: any): string {
  if (!header) return '';
  return String(header)
    .toLowerCase()
    .trim()
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
}

/**
 * Encontra o índice de uma coluna usando sinônimos
 */
export function findColumnIndex(headerRow: string[], fieldName: keyof typeof COLUMN_SYNONYMS): number {
  const synonyms = COLUMN_SYNONYMS[fieldName] || [];

  for (let i = 0; i < headerRow.length; i++) {
    const normalizedHeader = normalizeHeader(headerRow[i]);

    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeHeader(synonym);
      if (normalizedHeader.includes(normalizedSynonym) ||
          normalizedSynonym.includes(normalizedHeader)) {
        return i;
      }
    }
  }

  return -1;
}
