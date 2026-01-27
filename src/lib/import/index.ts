import ExcelJS from 'exceljs';
import { saveDataToDatabase } from './db';
import { detectAndParse } from './parsers';
import { Buffer } from 'node:buffer';

/**
 * Ponto de entrada principal para o processo de importação.
 *
 * @param fileBuffer O buffer do arquivo .xlsx enviado.
 * @param userId O ID do usuário que está fazendo o upload.
 * @param storeId O ID da loja de destino.
 * @param fileName O nome original do arquivo.
 * @returns Uma promessa que resolve com o resultado do parsing ou lança um erro.
 */
/**
 * Processa um arquivo Excel e importa os dados no banco de dados.
 * 
 * @param fileBuffer Buffer do arquivo .xlsx
 * @param userId ID do usuário autenticado
 * @param storeId ID da loja (ou 'temp-store-id' para criar automaticamente)
 * @param fileName Nome original do arquivo
 * @returns Resultado da importação com estrutura padronizada
 */
export async function processImport(
  fileBuffer: Buffer, 
  userId: string, 
  storeId: string, 
  fileName: string
): Promise<{
  success: boolean;
  message: string;
  marketplace: string;
  orderCount: number;
  skipped: number;
  totalProcessed: number;
}> {
  try {
    // 1. Valida buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Arquivo vazio ou inválido.');
    }

    // 2. Carrega o workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    // 3. Valida se há planilhas
    if (workbook.worksheets.length === 0) {
      throw new Error('A planilha está vazia ou não foi encontrada.');
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Não foi possível acessar a primeira planilha.');
    }

    // 4. Extrai todas as linhas como arrays
    const rows: any[][] = [];
    worksheet.eachRow((row, rowNumber) => {
      // Pula a primeira linha (cabeçalho)
      if (rowNumber === 1) return;
      
      const rowValues: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowValues.push(cell.value);
      });
      
      // Remove primeira coluna se estiver vazia (alguns formatos têm isso)
      if (rowValues.length > 0 && (rowValues[0] === null || rowValues[0] === undefined || rowValues[0] === '')) {
        rowValues.shift();
      }
      
      // Só adiciona se a linha tiver algum conteúdo
      if (rowValues.some(cell => cell !== null && cell !== undefined && cell !== '')) {
        rows.push(rowValues);
      }
    });

    if (rows.length === 0) {
      throw new Error('Nenhum dado encontrado na planilha. Verifique se há linhas de dados além do cabeçalho.');
    }

    console.log(`[processImport] Processando ${rows.length} linhas de dados do arquivo ${fileName}`);

    // 5. Detecta e faz parse dos dados
    const result = detectAndParse(rows);

    if (!result) {
      throw new Error('Não foi possível identificar o marketplace da planilha. Verifique se o arquivo é de um marketplace suportado (Mercado Livre, Shopee, Shein, TikTok).');
    }

    if (!result.normalizedData || result.normalizedData.length === 0) {
      throw new Error('Nenhum pedido válido foi encontrado na planilha após o processamento.');
    }

    console.log(`[processImport] Marketplace detectado: ${result.marketplaceName}, ${result.normalizedData.length} pedidos normalizados`);

    // 6. Salva os dados no banco de dados
    const saveResult = await saveDataToDatabase(
      userId, 
      result.marketplaceName, 
      result.normalizedData, 
      fileName, 
      storeId
    );

    // 7. Retorna resultado padronizado
    return {
      success: saveResult.success !== false,
      message: `Arquivo do marketplace '${result.marketplaceName}' processado com sucesso. ${saveResult.inserted || 0} pedidos importados, ${saveResult.skipped || 0} ignorados.`,
      marketplace: result.marketplaceName,
      orderCount: saveResult.inserted || 0,
      skipped: saveResult.skipped || 0,
      totalProcessed: result.normalizedData.length,
    };

  } catch (error: any) {
    // Log detalhado do erro
    console.error('[processImport] Erro ao processar importação:', error);
    console.error('[processImport] Stack:', error?.stack);
    
    // Propaga o erro para ser tratado pela API route
    throw error;
  }
}
