const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://adpqmanflokvedxqxztp.supabase.co';
const supabaseKey = 'sb_secret_A6yIRHPVTnRo02wQVDlpmQ_iOY7gNO_';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDatabase() {
  console.log('=== LIMPANDO BANCO DE DADOS ===\n');

  // 1. Deletar dados financeiros
  const { error: financialsError } = await supabase
    .from('order_financials')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta todos

  console.log('💰 Dados financeiros:', financialsError ? `Erro: ${financialsError.message}` : 'Deletados ✓');

  // 2. Deletar itens dos pedidos
  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('📦 Itens dos pedidos:', itemsError ? `Erro: ${itemsError.message}` : 'Deletados ✓');

  // 3. Deletar pedidos
  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('🛒 Pedidos:', ordersError ? `Erro: ${ordersError.message}` : 'Deletados ✓');

  // 4. Deletar importações
  const { error: importsError } = await supabase
    .from('imports')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('📄 Importações:', importsError ? `Erro: ${importsError.message}` : 'Deletadas ✓');

  // Verificar contagens finais
  const { count: ordersCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const { count: financialsCount } = await supabase.from('order_financials').select('*', { count: 'exact', head: true });

  console.log('\n=== VERIFICAÇÃO FINAL ===');
  console.log(`Pedidos restantes: ${ordersCount || 0}`);
  console.log(`Dados financeiros restantes: ${financialsCount || 0}`);
  console.log('\n✅ Banco limpo! Agora reimporte a planilha MELI.xlsx');
}

cleanDatabase().catch(console.error);
