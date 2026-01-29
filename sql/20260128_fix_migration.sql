-- ============================================================================
-- MIGRAÇÃO CORRIGIDA: Expansão do Schema de Importação
-- Versão que ignora itens já existentes
-- ============================================================================

-- ============================================================================
-- 1. ALTERAÇÕES NA TABELA orders
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_external_order_id
ON orders(external_order_id) WHERE external_order_id IS NOT NULL;

-- ============================================================================
-- 2. ALTERAÇÕES NA TABELA order_financials (CRÍTICO PARA O DASHBOARD)
-- ============================================================================

ALTER TABLE order_financials ADD COLUMN IF NOT EXISTS shipping_fee_buyer DECIMAL(12,2) DEFAULT 0;
ALTER TABLE order_financials ADD COLUMN IF NOT EXISTS platform_discount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE order_financials ADD COLUMN IF NOT EXISTS transaction_fee DECIMAL(12,2) DEFAULT 0;
ALTER TABLE order_financials ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(12,2) DEFAULT 0;
ALTER TABLE order_financials ADD COLUMN IF NOT EXISTS other_platform_fees DECIMAL(12,2) DEFAULT 0;

-- Renomear coluna fees para total_fees_legacy se existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'order_financials' AND column_name = 'fees') THEN
        ALTER TABLE order_financials RENAME COLUMN fees TO total_fees_legacy;
    END IF;
END $$;

-- Adiciona total_fees como campo calculado (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'order_financials' AND column_name = 'total_fees') THEN
        ALTER TABLE order_financials
        ADD COLUMN total_fees DECIMAL(12,2) GENERATED ALWAYS AS (
            COALESCE(transaction_fee, 0) +
            COALESCE(shipping_fee, 0) +
            COALESCE(other_platform_fees, 0)
        ) STORED;
    END IF;
END $$;

-- ============================================================================
-- 3. ALTERAÇÕES NA TABELA imports
-- ============================================================================

ALTER TABLE imports ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'imports' AND column_name = 'store_id') THEN
        ALTER TABLE imports ADD COLUMN store_id UUID REFERENCES stores(id);
    END IF;
END $$;

-- ============================================================================
-- 4. TABELA import_row_logs (se não existir)
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

CREATE INDEX IF NOT EXISTS idx_import_row_logs_import_id ON import_row_logs(import_id);
CREATE INDEX IF NOT EXISTS idx_import_row_logs_status ON import_row_logs(import_id, status);

-- ============================================================================
-- 5. TABELA column_mappings (se não existir)
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

-- ============================================================================
-- 6. FUNÇÕES E TRIGGERS
-- ============================================================================

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

DROP TRIGGER IF EXISTS trigger_update_import_counts ON import_row_logs;
CREATE TRIGGER trigger_update_import_counts
AFTER INSERT ON import_row_logs
FOR EACH ROW
EXECUTE FUNCTION update_import_counts();

-- ============================================================================
-- 7. VIEWS
-- ============================================================================

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
-- 8. RLS - REMOVE E RECRIA POLÍTICAS (evita erro de duplicata)
-- ============================================================================

ALTER TABLE import_row_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_mappings ENABLE ROW LEVEL SECURITY;

-- Remove políticas existentes antes de recriar
DROP POLICY IF EXISTS "Users can view their own import logs" ON import_row_logs;
DROP POLICY IF EXISTS "Users can insert their own import logs" ON import_row_logs;
DROP POLICY IF EXISTS "Users can manage their own mappings" ON column_mappings;

-- Recria políticas
CREATE POLICY "Users can view their own import logs"
ON import_row_logs FOR SELECT
USING (import_id IN (SELECT id FROM imports WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own import logs"
ON import_row_logs FOR INSERT
WITH CHECK (import_id IN (SELECT id FROM imports WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own mappings"
ON column_mappings FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 9. DADOS INICIAIS
-- ============================================================================

INSERT INTO marketplaces (name, display_name)
VALUES ('meli', 'Mercado Livre')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- FIM DA MIGRAÇÃO CORRIGIDA
-- ============================================================================
