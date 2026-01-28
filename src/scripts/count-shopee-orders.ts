import ExcelJS from 'exceljs';
import * as path from 'path';

async function countShopeeOrders() {
  try {
    const filePath = 'c:\\Users\\Desk\\Downloads\\Shopee.xlsx';
    console.log('Lendo arquivo:', filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.error('Nenhuma planilha encontrada no arquivo');
      return;
    }
    
    console.log('Nome da planilha:', worksheet.name);
    console.log('Total de linhas:', worksheet.rowCount);
    
    // Pega o cabeçalho
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '').trim();
    });
    
    console.log('\nCabeçalhos encontrados:');
    headers.forEach((h, i) => {
      if (h) console.log(`  ${i + 1}. ${h}`);
    });
    
    // Conta linhas com dados (pula o cabeçalho)
    let orderCount = 0;
    let emptyRows = 0;
    const orderIds = new Set<string>();
    
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const firstCell = row.getCell(1);
      const orderIdCell = row.getCell(headers.findIndex(h => 
        h && (h.toLowerCase().includes('order') || h.toLowerCase().includes('pedido'))
      ) + 1);
      
      if (firstCell.value || orderIdCell?.value) {
        orderCount++;
        if (orderIdCell?.value) {
          orderIds.add(String(orderIdCell.value));
        }
      } else {
        emptyRows++;
      }
    }
    
    console.log('\n========== RESULTADO ==========');
    console.log(`Total de linhas com dados: ${orderCount}`);
    console.log(`Linhas vazias: ${emptyRows}`);
    console.log(`Pedidos únicos (por ID): ${orderIds.size}`);
    console.log('===============================');
    
    // Mostra alguns exemplos de IDs
    if (orderIds.size > 0) {
      console.log('\nPrimeiros 5 IDs de pedidos:');
      Array.from(orderIds).slice(0, 5).forEach((id, i) => {
        console.log(`  ${i + 1}. ${id}`);
      });
    }
    
  } catch (error: any) {
    console.error('Erro ao processar arquivo:', error.message);
    console.error(error.stack);
  }
}

countShopeeOrders();
