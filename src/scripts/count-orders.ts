import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Carrega variáveis de ambiente
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.error('   Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function countOrders() {
  console.log('📊 Contando pedidos no banco de dados...\n');

  try {
    // Conta total de pedidos
    const { count: totalOrders, error: totalError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Erro ao contar pedidos:', totalError);
      return;
    }

    console.log(`✅ Total de pedidos: ${totalOrders || 0}\n`);

    // Conta por marketplace
    const { data: ordersWithStores, error: ordersError } = await supabase
      .from('orders')
      .select('store_id, stores(marketplace_id, marketplaces(name, display_name))')
      .limit(10000); // Limite alto para pegar todos

    if (ordersError) {
      console.error('❌ Erro ao buscar pedidos:', ordersError);
      return;
    }

    // Agrupa por marketplace
    const marketplaceCounts = new Map<string, { name: string; count: number }>();
    
    (ordersWithStores || []).forEach((order: any) => {
      const marketplace = order.stores?.marketplaces;
      if (marketplace) {
        const key = marketplace.name || 'unknown';
        const existing = marketplaceCounts.get(key) || {
          name: marketplace.display_name || marketplace.name || 'Desconhecido',
          count: 0,
        };
        existing.count += 1;
        marketplaceCounts.set(key, existing);
      }
    });

    console.log('📦 Pedidos por marketplace:');
    marketplaceCounts.forEach((stats, key) => {
      console.log(`   ${stats.name}: ${stats.count} pedidos`);
    });

    // Conta por loja
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, marketplace_id, marketplaces(name, display_name)');

    if (!storesError && stores) {
      console.log('\n🏪 Pedidos por loja:');
      for (const store of stores) {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', store.id);

        const marketplaceName = store.marketplaces?.display_name || store.marketplaces?.name || 'Desconhecido';
        console.log(`   ${store.name} (${marketplaceName}): ${count || 0} pedidos`);
      }
    }

    // Últimos pedidos importados
    console.log('\n📅 Últimos 10 pedidos importados:');
    const { data: recentOrders, error: recentError } = await supabase
      .from('orders')
      .select('platform_order_id, order_date, stores(name, marketplaces(display_name))')
      .order('order_date', { ascending: false })
      .limit(10);

    if (!recentError && recentOrders) {
      recentOrders.forEach((order: any) => {
        const date = order.order_date ? new Date(order.order_date).toLocaleDateString('pt-BR') : 'N/A';
        const storeName = order.stores?.name || 'Desconhecida';
        const marketplace = order.stores?.marketplaces?.display_name || 'Desconhecido';
        console.log(`   ${order.platform_order_id} - ${date} - ${storeName} (${marketplace})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
}

countOrders()
  .then(() => {
    console.log('\n✅ Consulta concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
