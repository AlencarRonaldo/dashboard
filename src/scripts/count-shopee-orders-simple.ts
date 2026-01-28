import ExcelJS from 'exceljs';
import shopeeParser from '../lib/import/parsers/shopee';

async function countShopeeOrders() {
  try {
    const filePath = 'c:\\Users\\Desk\\Downloads\\Shopee.xlsx';
    console.log('📊 Lendo arquivo:', filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.error('❌ Nenhuma planilha encontrada no arquivo');
      return;
    }
    
    console.log('📄 Nome da planilha:', worksheet.name);
    console.log('📏 Total de linhas brutas:', worksheet.rowCount);
    
    // Converte para array de arrays (formato esperado pelo parser)
    const rows: any[][] = [];
    worksheet.eachRow((row, rowNumber) => {
      const rowData: any[] = [];
      row.eachCell((cell, colNumber) => {
        rowData[colNumber - 1] = cell.value;
      });
      rows.push(rowData);
    });
    
    console.log('🔄 Processando com parser da Shopee...');
    const normalizedOrders = shopeeParser.parse(rows);
    
    if (!normalizedOrders || normalizedOrders.length === 0) {
      console.log('❌ Nenhum pedido válido encontrado ou parser não identificou como Shopee');
      console.log('\nPrimeiras linhas da planilha:');
      rows.slice(0, 3).forEach((row, i) => {
        console.log(`  Linha ${i + 1}:`, row.slice(0, 5).map(v => String(v || '').substring(0, 20)).join(' | '));
      });
      return;
    }
    
    // Conta pedidos únicos por platform_order_id
    const uniqueOrderIds = new Set(normalizedOrders.map(o => o.platform_order_id));
    
    console.log('\n========== RESULTADO ==========');
    console.log(`✅ Total de pedidos válidos: ${normalizedOrders.length}`);
    console.log(`🔑 Pedidos únicos (por ID): ${uniqueOrderIds.size}`);
    console.log('===============================');
    
    // Mostra alguns exemplos
    if (normalizedOrders.length > 0) {
      console.log('\n📋 Primeiros 5 pedidos:');
      normalizedOrders.slice(0, 5).forEach((order, i) => {
        console.log(`  ${i + 1}. ID: ${order.platform_order_id} | Data: ${order.order_date?.toISOString().split('T')[0]} | Valor: R$ ${order.order_value?.toFixed(2) || '0.00'}`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Erro ao processar arquivo:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

countShopeeOrders();
