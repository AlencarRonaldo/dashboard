const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://adpqmanflokvedxqxztp.supabase.co';
const supabaseKey = 'sb_secret_A6yIRHPVTnRo02wQVDlpmQ_iOY7gNO_';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('=== VERIFICAÇÃO DO BANCO DE DADOS ===\n');

  // 1. Contar pedidos
  const { count: ordersCount, error: ordersError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  console.log(`📦 Total de Pedidos: ${ordersCount || 0}`);
  if (ordersError) console.log('   Erro:', ordersError.message);

  // 2. Contar dados financeiros
  const { count: financialsCount, error: financialsError } = await supabase
    .from('order_financials')
    .select('*', { count: 'exact', head: true });

  console.log(`💰 Total de Registros Financeiros: ${financialsCount || 0}`);
  if (financialsError) console.log('   Erro:', financialsError.message);

  // 3. Verificar lojas
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name, marketplace_id');

  console.log(`\n🏪 Lojas cadastradas: ${stores?.length || 0}`);
  if (stores && stores.length > 0) {
    stores.forEach(s => console.log(`   - ${s.name} (ID: ${s.id})`));
  }

  // 4. Verificar marketplaces
  const { data: marketplaces } = await supabase
    .from('marketplaces')
    .select('name, display_name');

  console.log(`\n🛒 Marketplaces:`);
  if (marketplaces) {
    marketplaces.forEach(m => console.log(`   - ${m.display_name} (${m.name})`));
  }

  // 5. Amostra de dados financeiros (se existir)
  if (financialsCount > 0) {
    const { data: sampleFinancials } = await supabase
      .from('order_financials')
      .select('order_id, order_value, revenue, profit, profit_margin, total_fees')
      .limit(5);

    console.log('\n📊 Amostra de dados financeiros:');
    if (sampleFinancials) {
      sampleFinancials.forEach((f, i) => {
        console.log(`   ${i+1}. Valor: R$ ${f.order_value || 0}, Receita: R$ ${f.revenue || 0}, Lucro: R$ ${f.profit || 0}, Margem: ${f.profit_margin || 0}%`);
      });
    }
  }

  // 6. Verificar pedidos por marketplace
  const { data: ordersByMarketplace } = await supabase
    .from('orders')
    .select(`
      id,
      platform_order_id,
      stores!inner(name, marketplaces!inner(display_name))
    `)
    .limit(10);

  if (ordersByMarketplace && ordersByMarketplace.length > 0) {
    console.log('\n📋 Últimos pedidos por marketplace:');
    ordersByMarketplace.forEach((o, i) => {
      const marketplace = o.stores?.marketplaces?.display_name || 'Desconhecido';
      console.log(`   ${i+1}. ${o.platform_order_id} - ${marketplace}`);
    });
  }

  // 7. Soma total dos valores
  const { data: totals } = await supabase
    .from('order_financials')
    .select('order_value, revenue, profit');

  if (totals && totals.length > 0) {
    const totalRevenue = totals.reduce((sum, t) => sum + (Number(t.revenue) || 0), 0);
    const totalProfit = totals.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
    const totalOrderValue = totals.reduce((sum, t) => sum + (Number(t.order_value) || 0), 0);

    console.log('\n💵 TOTAIS:');
    console.log(`   Faturamento (order_value): R$ ${totalOrderValue.toFixed(2)}`);
    console.log(`   Receita (revenue): R$ ${totalRevenue.toFixed(2)}`);
    console.log(`   Lucro (profit): R$ ${totalProfit.toFixed(2)}`);
  }

  console.log('\n=== FIM DA VERIFICAÇÃO ===');
}

checkDatabase().catch(console.error);
