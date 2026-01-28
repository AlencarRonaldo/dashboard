const ExcelJS = require('exceljs');

async function checkMeliColumns() {
  try {
    const filePath = 'c:\\Users\\Desk\\Downloads\\MELI.xlsx';
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
    
    console.log('\n📋 TODAS AS COLUNAS ENCONTRADAS:');
    headers.forEach((h, i) => {
      if (h) console.log(`  ${i + 1}. ${h}`);
    });
    
    // Procura por colunas de taxas e custos
    console.log('\n🔍 BUSCANDO COLUNAS DE TAXAS E CUSTOS:');
    
    const taxColumns = {
      'Custo do Produto': headers.findIndex(h => h && (h.toLowerCase().includes('custo do produto') || h.toLowerCase().includes('custo'))),
      'Comissão': headers.findIndex(h => h && (h.toLowerCase().startsWith('comissão') || h.toLowerCase().startsWith('comissao'))),
      'Taxa de Transação': headers.findIndex(h => h && (h.toLowerCase().includes('taxa de transação') || h.toLowerCase().includes('taxa de transacao') || h.toLowerCase().includes('transaction fee'))),
      'Taxa de Serviço': headers.findIndex(h => h && (h.toLowerCase().includes('taxa de serviço') || h.toLowerCase().includes('taxa de servico') || h.toLowerCase().includes('service fee'))),
      'Taxa do Frete': headers.findIndex(h => h && (h.toLowerCase().includes('taxa do frete') || h.toLowerCase().includes('taxa de frete') || (h.toLowerCase().includes('frete') && !h.toLowerCase().includes('paga pelo comprador')))),
      'Outra Taxa da Plataforma': headers.findIndex(h => h && (h.toLowerCase().includes('outra taxa da plataforma') || h.toLowerCase().includes('outra taxa') || h.toLowerCase().includes('other platform fee'))),
      'Reembolso': headers.findIndex(h => h && (h.toLowerCase().includes('reembolso') || h.toLowerCase().includes('reemb'))),
      'Lucro': headers.findIndex(h => h && h.toLowerCase() === 'lucro' && !h.toLowerCase().includes('margem')),
      'Margem de Lucro': headers.findIndex(h => h && (h.toLowerCase().includes('margem') && h.toLowerCase().includes('lucro'))),
    };
    
    Object.entries(taxColumns).forEach(([name, index]) => {
      if (index !== -1) {
        console.log(`  ✅ ${name}: Coluna ${index + 1} - "${headers[index]}"`);
      } else {
        console.log(`  ❌ ${name}: Não encontrado`);
      }
    });
    
    // Procura por outras colunas financeiras importantes
    console.log('\n💰 COLUNAS FINANCEIRAS PRINCIPAIS:');
    const financialColumns = {
      'Valor do Pedido': headers.findIndex(h => h && h.toLowerCase().includes('valor do pedido')),
      'Receita': headers.findIndex(h => h && (h.toLowerCase() === 'receita' || h.toLowerCase().includes('valor de liquidação'))),
      'Vendas de Produtos': headers.findIndex(h => h && h.toLowerCase().includes('vendas de produtos')),
    };
    
    Object.entries(financialColumns).forEach(([name, index]) => {
      if (index !== -1) {
        console.log(`  ✅ ${name}: Coluna ${index + 1} - "${headers[index]}"`);
      } else {
        console.log(`  ❌ ${name}: Não encontrado`);
      }
    });
    
    // Analisa algumas linhas de dados para ver valores
    console.log('\n📊 ANÁLISE DE DADOS (primeiras 3 linhas):');
    for (let i = 2; i <= Math.min(4, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      const orderId = row.getCell(taxColumns['Comissão'] !== -1 ? taxColumns['Comissão'] + 1 : 1)?.value;
      
      console.log(`\n  Linha ${i}:`);
      if (taxColumns['Custo do Produto'] !== -1) {
        const cost = row.getCell(taxColumns['Custo do Produto'] + 1)?.value;
        console.log(`    Custo do Produto: ${cost}`);
      }
      if (taxColumns['Comissão'] !== -1) {
        const commission = row.getCell(taxColumns['Comissão'] + 1)?.value;
        console.log(`    Comissão: ${commission}`);
      }
      if (taxColumns['Taxa de Transação'] !== -1) {
        const txFee = row.getCell(taxColumns['Taxa de Transação'] + 1)?.value;
        console.log(`    Taxa de Transação: ${txFee}`);
      }
      if (taxColumns['Taxa de Serviço'] !== -1) {
        const serviceFee = row.getCell(taxColumns['Taxa de Serviço'] + 1)?.value;
        console.log(`    Taxa de Serviço: ${serviceFee}`);
      }
      if (taxColumns['Taxa do Frete'] !== -1) {
        const freight = row.getCell(taxColumns['Taxa do Frete'] + 1)?.value;
        console.log(`    Taxa do Frete: ${freight}`);
      }
      if (taxColumns['Outra Taxa da Plataforma'] !== -1) {
        const otherFee = row.getCell(taxColumns['Outra Taxa da Plataforma'] + 1)?.value;
        console.log(`    Outra Taxa: ${otherFee}`);
      }
      if (taxColumns['Reembolso'] !== -1) {
        const refund = row.getCell(taxColumns['Reembolso'] + 1)?.value;
        console.log(`    Reembolso: ${refund}`);
      }
      if (taxColumns['Lucro'] !== -1) {
        const profit = row.getCell(taxColumns['Lucro'] + 1)?.value;
        console.log(`    Lucro: ${profit}`);
      }
    }
    
    console.log('\n========== RESUMO ==========');
    const foundColumns = Object.values(taxColumns).filter(idx => idx !== -1).length;
    const totalColumns = Object.keys(taxColumns).length;
    console.log(`Colunas de taxas encontradas: ${foundColumns} de ${totalColumns}`);
    console.log('=============================');
    
  } catch (error) {
    console.error('❌ Erro ao processar arquivo:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

checkMeliColumns();
