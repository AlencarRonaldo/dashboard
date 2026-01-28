const ExcelJS = require('exceljs');

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
    
    // Pega o cabeçalho
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '').trim();
    });
    
    console.log('\n📋 Cabeçalhos encontrados:');
    headers.forEach((h, i) => {
      if (h) console.log(`  ${i + 1}. ${h}`);
    });
    
    // Encontra índice da coluna de Order ID
    const orderIdIndex = headers.findIndex(h => 
      h && (h.toLowerCase().includes('order') || h.toLowerCase().includes('pedido'))
    );
    
    console.log(`\n🔍 Coluna de Order ID encontrada no índice: ${orderIdIndex + 1} (${headers[orderIdIndex] || 'N/A'})`);
    
    // Conta linhas com dados (pula o cabeçalho)
    let orderCount = 0;
    let emptyRows = 0;
    const orderIds = new Set();
    
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const firstCell = row.getCell(1);
      const orderIdCell = orderIdIndex >= 0 ? row.getCell(orderIdIndex + 1) : null;
      
      if (firstCell.value || (orderIdCell && orderIdCell.value)) {
        orderCount++;
        if (orderIdCell && orderIdCell.value) {
          orderIds.add(String(orderIdCell.value));
        }
      } else {
        emptyRows++;
      }
    }
    
    console.log('\n========== RESULTADO ==========');
    console.log(`✅ Total de linhas com dados: ${orderCount}`);
    console.log(`🔑 Pedidos únicos (por ID): ${orderIds.size}`);
    console.log(`⚪ Linhas vazias: ${emptyRows}`);
    console.log('===============================');
    
    // Mostra alguns exemplos de IDs
    if (orderIds.size > 0) {
      console.log('\n📋 Primeiros 10 IDs de pedidos:');
      Array.from(orderIds).slice(0, 10).forEach((id, i) => {
        console.log(`  ${i + 1}. ${id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar arquivo:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

countShopeeOrders();
