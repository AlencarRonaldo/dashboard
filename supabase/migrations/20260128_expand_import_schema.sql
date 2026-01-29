-- ============================================================================
-- MIGRAÇÃO: Expansão do Schema de Importação
-- Data: 2026-01-28
-- Descrição: Adiciona novos campos para capturar todos os dados das planilhas
--            de marketplaces e implementa sistema de logs por linha
-- ============================================================================

-- ============================================================================
-- 1. ALTERAÇÕES NA TABELA orders
-- ============================================================================

-- ID do pedido em sistemas externos (ex: UpSeller, Bling, Tiny)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS external_order_id TEXT;

-- Nome da plataforma origem (para auditoria/rastreabilidade)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS platform_name TEXT;

-- Nome da loja conforme aparece na planilha (redundância para auditoria)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Índice para busca por ID externo
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id
ON orders(external_order_id)
WHERE external_order_id IS NOT NULL;

-- Índice composto para evitar duplicatas considerando sistema externo
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_external_unique
ON orders(store_id, external_order_id)
WHERE external_order_id IS NOT NULL;

COMMENT ON COLUMN orders.external_order_id IS 'ID do pedido em sistema externo (UpSeller, Bling, etc)';
COMMENT ON COLUMN orders.platform_name IS 'Nome da plataforma origem conforme planilha';
COMMENT ON COLUMN orders.store_name IS 'Nome da loja conforme planilha (auditoria)';

-- ============================================================================
-- 2. ALTERAÇÕES NA TABELA order_financials
-- ============================================================================

-- Taxa de frete paga pelo comprador (receita adicional)
ALTER TABLE order_financials
ADD COLUMN IF NOT EXISTS shipping_fee_buyer DECIMAL(12,2) DEFAULT 0;

-- Desconto e subsídio da plataforma (benefício)
ALTER TABLE order_financials
ADD COLUMN IF NOT EXISTS platform_discount DECIMAL(12,2) DEFAULT 0;

-- Taxa de transação específica
ALTER TABLE order_financials
ADD COLUMN IF NOT EXISTS transaction_fee DECIMAL(12,2) DEFAULT 0;

-- Taxa de frete (custo para o vendedor)
ALTER TABLE order_financials
ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(12,2) DEFAULT 0;

-- Outras taxas da plataforma
ALTER TABLE order_financials
ADD COLUMN IF NOT EXISTS other_platform_fees DECIMAL(12,2) DEFAULT 0;

-- Renomear coluna fees para total_fees e manter como campo calculado
-- (mantém retrocompatibilidade)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'order_financials' AND column_name = 'fees') THEN
        ALTER TABLE order_financials RENAME COLUMN fees TO total_fees_legacy;
    END IF;
END $$;

-- Campo calculado para total de taxas (soma de todas as taxas individuais)
ALTER TABLE order_financials
ADD COLUMN IF NOT EXISTS total_fees DECIMAL(12,2) GENERATED ALWAYS AS (
    COALESCE(transaction_fee, 0) +
    COALESCE(shipping_fee, 0) +
    COALESCE(other_platform_fees, 0)
) STORED;

COMMENT ON COLUMN order_financials.shipping_fee_buyer IS 'Frete pago pelo comprador';
COMMENT ON COLUMN order_financials.platform_discount IS 'Desconto/subsídio da plataforma';
COMMENT ON COLUMN order_financials.transaction_fee IS 'Taxa de transação';
COMMENT ON COLUMN order_financials.shipping_fee IS 'Taxa de frete (custo vendedor)';
COMMENT ON COLUMN order_financials.other_platform_fees IS 'Outras taxas da plataforma';
COMMENT ON COLUMN order_financials.total_fees IS 'Total de taxas (calculado)';

-- ============================================================================
-- 3. ALTERAÇÕES NA TABELA imports
-- ============================================================================

-- Adicionar contadores de linhas
ALTER TABLE imports
ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0;

ALTER TABLE imports
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;

ALTER TABLE imports
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

ALTER TABLE imports
ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;

-- Referência à loja (pode processar múltiplas lojas)
ALTER TABLE imports
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

COMMENT ON COLUMN imports.total_rows IS 'Total de linhas na planilha (excluindo cabeçalho)';
COMMENT ON COLUMN imports.success_count IS 'Linhas importadas com sucesso';
COMMENT ON COLUMN imports.error_count IS 'Linhas com erro';
COMMENT ON COLUMN imports.skipped_count IS 'Linhas ignoradas (duplicatas, etc)';

-- ============================================================================
-- 4. NOVA TABELA: import_row_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS import_row_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped', 'warning')),
    platform_order_id TEXT,
    external_order_id TEXT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    error_message TEXT,
    warning_message TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_import_row_logs_import_id
ON import_row_logs(import_id);

CREATE INDEX IF NOT EXISTS idx_import_row_logs_status
ON import_row_logs(import_id, status);

CREATE INDEX IF NOT EXISTS idx_import_row_logs_order_id
ON import_row_logs(order_id)
WHERE order_id IS NOT NULL;

COMMENT ON TABLE import_row_logs IS 'Log detalhado linha a linha de cada importação';
COMMENT ON COLUMN import_row_logs.row_number IS 'Número da linha na planilha original';
COMMENT ON COLUMN import_row_logs.status IS 'Status: success, error, skipped, warning';
COMMENT ON COLUMN import_row_logs.raw_data IS 'Dados originais da linha em JSON';

-- ============================================================================
-- 5. NOVA TABELA: column_mappings (para mapeamento dinâmico)
-- ============================================================================

CREATE TABLE IF NOT EXISTS column_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marketplace TEXT NOT NULL,
    source_column TEXT NOT NULL,
    target_field TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, marketplace, source_column)
);

COMMENT ON TABLE column_mappings IS 'Mapeamentos customizados de colunas por usuário/marketplace';

-- ============================================================================
-- 6. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para atualizar contadores de importação
CREATE OR REPLACE FUNCTION update_import_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE imports
    SET
        success_count = (SELECT COUNT(*) FROM import_row_logs WHERE import_id = NEW.import_id AND status = 'success'),
        error_count = (SELECT COUNT(*) FROM import_row_logs WHERE import_id = NEW.import_id AND status = 'error'),
        skipped_count = (SELECT COUNT(*) FROM import_row_logs WHERE import_id = NEW.import_id AND status = 'skipped')
    WHERE id = NEW.import_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar contadores automaticamente
DROP TRIGGER IF EXISTS trigger_update_import_counts ON import_row_logs;
CREATE TRIGGER trigger_update_import_counts
AFTER INSERT ON import_row_logs
FOR EACH ROW
EXECUTE FUNCTION update_import_counts();

-- ============================================================================
-- 7. VIEWS PARA RELATÓRIOS
-- ============================================================================

-- View consolidada de pedidos com financeiro
CREATE OR REPLACE VIEW v_orders_complete AS
SELECT
    o.id,
    o.store_id,
    o.platform_order_id,
    o.external_order_id,
    o.platform_name,
    o.store_name,
    o.order_date,
    o.settlement_date,
    s.name as store_display_name,
    m.display_name as marketplace_display_name,
    oi.sku,
    oi.quantity,
    of.order_value,
    of.revenue,
    of.product_sales,
    of.shipping_fee_buyer,
    of.platform_discount,
    of.commissions,
    of.transaction_fee,
    of.shipping_fee,
    of.other_platform_fees,
    of.total_fees,
    of.refunds,
    of.product_cost,
    of.profit,
    of.profit_margin
FROM orders o
LEFT JOIN stores s ON o.store_id = s.id
LEFT JOIN marketplaces m ON s.marketplace_id = m.id
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN order_financials of ON o.id = of.order_id;

-- View de resumo de importações
CREATE OR REPLACE VIEW v_import_summary AS
SELECT
    i.id,
    i.user_id,
    i.file_name,
    i.status,
    i.total_rows,
    i.success_count,
    i.error_count,
    i.skipped_count,
    i.created_at,
    i.finished_at,
    s.name as store_name,
    m.display_name as marketplace_name,
    CASE
        WHEN i.total_rows > 0
        THEN ROUND((i.success_count::DECIMAL / i.total_rows) * 100, 2)
        ELSE 0
    END as success_rate
FROM imports i
LEFT JOIN stores s ON i.store_id = s.id
LEFT JOIN marketplaces m ON s.marketplace_id = m.id;

-- ============================================================================
-- 8. RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE import_row_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_mappings ENABLE ROW LEVEL SECURITY;

-- Políticas para import_row_logs
CREATE POLICY "Users can view their own import logs"
ON import_row_logs FOR SELECT
USING (
    import_id IN (
        SELECT id FROM imports WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own import logs"
ON import_row_logs FOR INSERT
WITH CHECK (
    import_id IN (
        SELECT id FROM imports WHERE user_id = auth.uid()
    )
);

-- Políticas para column_mappings
CREATE POLICY "Users can manage their own mappings"
ON column_mappings FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 9. DADOS INICIAIS (se necessário)
-- ============================================================================

-- Garantir que o marketplace "Mercado Livre" existe
INSERT INTO marketplaces (name, display_name)
VALUES ('meli', 'Mercado Livre')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================
