/**
 * Script para testar o fluxo completo de importação
 * Verifica se os dados estão sendo salvos no banco
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Carrega variáveis de ambiente
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.log('Necessário:');
  console.log('  - NEXT_PUBLIC_SUPABASE_URL');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

// Usa Service Role Key para bypass RLS (apenas para testes)
const supabase = createClient(supabaseUrl, supabaseKey);

async function testImportFlow() {
  console.log('🔍 Testando fluxo de importação...\n');

  try {
    // 1. Verificar conexão
    console.log('1️⃣ Verificando conexão com Supabase...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('marketplaces')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.error('❌ Erro de conexão:', healthError);
      return;
    }
    console.log('✅ Conexão OK\n');

    // 2. Verificar marketplaces
    console.log('2️⃣ Verificando marketplaces cadastrados...');
    const { data: marketplaces, error: mpError } = await supabase
      .from('marketplaces')
      .select('id, name, display_name');
    
    if (mpError) {
      console.error('❌ Erro ao buscar marketplaces:', mpError);
      return;
    }
    
    console.log(`✅ ${marketplaces?.length || 0} marketplaces encontrados:`);
    marketplaces?.forEach(mp => {
      console.log(`   - ${mp.name} (${mp.display_name})`);
    });
    console.log('');

    // 3. Verificar tabelas
    console.log('3️⃣ Verificando estrutura das tabelas...');
    const tables = ['imports', 'stores', 'orders', 'order_items', 'order_financials'];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error(`❌ Erro ao acessar tabela ${table}:`, error.message);
      } else {
        console.log(`✅ Tabela ${table}: ${count || 0} registros`);
      }
    }
    console.log('');

    // 4. Verificar RLS
    console.log('4️⃣ Verificando políticas RLS...');
    const { data: rlsPolicies, error: rlsError } = await supabase.rpc('get_rls_policies');
    
    if (rlsError) {
      console.log('⚠️  Não foi possível verificar políticas RLS diretamente');
      console.log('   (Isso é normal - RLS é verificado pelo Supabase)');
    } else {
      console.log('✅ Políticas RLS verificadas');
    }
    console.log('');

    // 5. Testar inserção (se houver usuário de teste)
    console.log('5️⃣ Verificando imports existentes...');
    const { data: imports, error: importsError } = await supabase
      .from('imports')
      .select('*, orders(count)')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (importsError) {
      console.error('❌ Erro ao buscar imports:', importsError);
    } else {
      console.log(`✅ ${imports?.length || 0} imports encontrados:`);
      imports?.forEach(imp => {
        const orderCount = Array.isArray(imp.orders) ? imp.orders.length : (imp.orders as any)?.count || 0;
        console.log(`   - ${imp.file_name} (${imp.status}) - ${orderCount} pedidos`);
      });
    }
    console.log('');

    // 6. Verificar pedidos
    console.log('6️⃣ Verificando pedidos...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, platform_order_id, order_date, store_id, order_financials(revenue, profit)')
      .limit(10);
    
    if (ordersError) {
      console.error('❌ Erro ao buscar pedidos:', ordersError);
    } else {
      console.log(`✅ ${orders?.length || 0} pedidos encontrados (mostrando até 10):`);
      orders?.forEach(order => {
        const financials = Array.isArray(order.order_financials) 
          ? order.order_financials[0] 
          : order.order_financials;
        console.log(`   - ${order.platform_order_id} (${new Date(order.order_date).toLocaleDateString('pt-BR')}) - R$ ${financials?.revenue || 0}`);
      });
    }
    console.log('');

    console.log('✅ Teste concluído!');
    console.log('\n💡 Se não houver dados, verifique:');
    console.log('   1. Se a importação foi executada');
    console.log('   2. Se há erros nos logs do servidor');
    console.log('   3. Se as políticas RLS estão corretas');
    console.log('   4. Se o usuário está autenticado');

  } catch (error: any) {
    console.error('\n❌ Erro durante o teste:', error);
    console.error('Stack:', error?.stack);
    process.exit(1);
  }
}

testImportFlow();
