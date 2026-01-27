/**
 * Script para testar a importação de arquivos Shein
 * 
 * Uso: npx tsx src/scripts/test-shein-import.ts <caminho-do-arquivo>
 */

import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { detectAndParse } from '../lib/import/parsers';
import { createServer } from '../lib/supabase/utils';

async function testSheinImport(filePath: string) {
  console.log('🔍 Testando importação do arquivo Shein...\n');
  console.log(`📁 Arquivo: ${filePath}\n`);

  try {
    // 1. Lê o arquivo
    console.log('1️⃣ Lendo arquivo Excel...');
    const fileBuffer = readFileSync(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Planilha não encontrada');
    }

    console.log(`   ✅ Planilha encontrada: "${worksheet.name}"`);
    console.log(`   📊 Total de linhas: ${worksheet.rowCount}\n`);

    // 2. Extrai as linhas
    console.log('2️⃣ Extraindo dados da planilha...');
    const rows: any[][] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Pula cabeçalho na primeira passada
      const rowValues: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowValues.push(cell.value);
      });
      if (rowValues.length > 0 && rowValues[0] !== null) {
        rows.push(rowValues);
      }
    });

    // Adiciona o cabeçalho
    const headerRow: any[] = [];
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      headerRow.push(cell.value);
    });
    rows.unshift(headerRow);

    console.log(`   ✅ ${rows.length - 1} linhas de dados extraídas\n`);

    // 3. Mostra o cabeçalho
    console.log('3️⃣ Cabeçalho da planilha:');
    console.log('   ' + headerRow.map((h, i) => `${i}: ${h || '(vazio)'}`).join(' | '));
    console.log('');

    // 4. Detecta e faz parse
    console.log('4️⃣ Detectando marketplace e fazendo parse...');
    const result = detectAndParse(rows);

    if (!result) {
      console.error('   ❌ Não foi possível identificar o marketplace ou fazer parse dos dados');
      console.log('\n   💡 Verifique se:');
      console.log('      - O arquivo contém colunas como "Order No", "Order Time", etc.');
      console.log('      - O formato do arquivo está correto');
      return;
    }

    console.log(`   ✅ Marketplace detectado: ${result.marketplaceName}`);
    console.log(`   ✅ ${result.normalizedData.length} pedidos normalizados\n`);

    // 5. Mostra amostra dos dados normalizados
    console.log('5️⃣ Amostra dos dados normalizados (primeiros 3 pedidos):');
    result.normalizedData.slice(0, 3).forEach((order, index) => {
      console.log(`\n   Pedido ${index + 1}:`);
      console.log(`      ID: ${order.platform_order_id}`);
      console.log(`      Data: ${order.order_date}`);
      console.log(`      SKU: ${order.sku}`);
      console.log(`      Quantidade: ${order.quantity}`);
      console.log(`      Valor: R$ ${order.order_value?.toFixed(2) || '0.00'}`);
      console.log(`      Receita: R$ ${order.revenue?.toFixed(2) || '0.00'}`);
      console.log(`      Lucro: R$ ${order.profit?.toFixed(2) || 'N/A'}`);
      console.log(`      Margem: ${order.profit_margin?.toFixed(2) || 'N/A'}%`);
    });
    console.log('');

    // 6. Verifica se o marketplace está no banco
    console.log('6️⃣ Verificando marketplace no banco de dados...');
    const supabase = createServer();
    const { data: marketplace, error: marketplaceError } = await supabase
      .from('marketplaces')
      .select('id, name, display_name')
      .eq('name', 'shein')
      .maybeSingle();

    if (marketplaceError) {
      console.error(`   ❌ Erro ao buscar marketplace: ${marketplaceError.message}`);
      return;
    }

    if (!marketplace) {
      console.error('   ❌ Marketplace "shein" não encontrado no banco de dados');
      console.log('\n   💡 Execute o SQL para criar o marketplace:');
      console.log('      INSERT INTO marketplaces (name, display_name) VALUES (\'shein\', \'Shein\');');
      return;
    }

    console.log(`   ✅ Marketplace encontrado: ${marketplace.display_name} (ID: ${marketplace.id})\n`);

    // 7. Estatísticas
    console.log('7️⃣ Estatísticas dos dados:');
    const totalValue = result.normalizedData.reduce((sum, o) => sum + (o.order_value || 0), 0);
    const totalRevenue = result.normalizedData.reduce((sum, o) => sum + (o.revenue || 0), 0);
    const totalProfit = result.normalizedData.reduce((sum, o) => sum + (o.profit || 0), 0);
    const avgMargin = result.normalizedData
      .filter(o => o.profit_margin !== undefined)
      .reduce((sum, o, _, arr) => sum + (o.profit_margin || 0) / arr.length, 0);

    console.log(`   📊 Total de pedidos: ${result.normalizedData.length}`);
    console.log(`   💰 Valor total: R$ ${totalValue.toFixed(2)}`);
    console.log(`   💵 Receita total: R$ ${totalRevenue.toFixed(2)}`);
    console.log(`   💸 Lucro total: R$ ${totalProfit.toFixed(2)}`);
    console.log(`   📈 Margem média: ${avgMargin.toFixed(2)}%\n`);

    console.log('✅ Teste concluído com sucesso!');
    console.log('\n💡 Para importar os dados, use a interface web em /import');

  } catch (error: any) {
    console.error('\n❌ Erro durante o teste:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Executa o teste
const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ Por favor, forneça o caminho do arquivo Shein.xlsx');
  console.log('\nUso: npx tsx src/scripts/test-shein-import.ts <caminho-do-arquivo>');
  process.exit(1);
}

testSheinImport(filePath);
