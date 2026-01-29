import ExcelJS from 'exceljs';
import { saveDataToDatabase } from './db';
import { detectAndParse } from './parsers';
import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Processa um arquivo Excel e importa os dados no banco de dados.
 *
 * @param supabase Cliente Supabase (deve ser passado da Route Handler)
 * @param fileBuffer Buffer do arquivo .xlsx
 * @param userId ID do usuário autenticado
 * @param storeId ID da loja (ou 'temp-store-id' para criar automaticamente)
 * @param fileName Nome original do arquivo
 * @param marketplaceHint Marketplace selecionado pelo usuário (opcional, usado como fallback)
 * @returns Resultado da importação com estrutura padronizada
 */
export async function processImport(
  supabase: SupabaseClient<Database>,
  fileBuffer: Buffer,
  userId: string,
  storeId: string,
  fileName: string,
  marketplaceHint?: string | null
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
    await workbook.xlsx.load(fileBuffer as any);

    // 3. Valida se há planilhas
    if (workbook.worksheets.length === 0) {
      throw new Error('A planilha está vazia ou não foi encontrada.');
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Não foi possível acessar a primeira planilha.');
    }

    // 4. Extrai todas as linhas como arrays (INCLUINDO o cabeçalho)
    const rows: any[][] = [];
    
    // Primeiro, extrai o cabeçalho (linha 1)
    const headerRow: any[] = [];
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell({ includeEmpty: true }, (cell) => {
      headerRow.push(cell.value);
    });
    // Remove primeira coluna vazia se existir
    if (headerRow.length > 0 && (headerRow[0] === null || headerRow[0] === undefined || headerRow[0] === '')) {
      headerRow.shift();
    }
    rows.push(headerRow);
    console.log(`[processImport] Cabeçalho extraído: ${headerRow.length} colunas`);
    
    // Depois, extrai as linhas de dados (a partir da linha 2)
    worksheet.eachRow((row, rowNumber) => {
      // Pula a primeira linha (já foi extraída acima)
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

    if (rows.length <= 1) {
      throw new Error('Nenhum dado encontrado na planilha. Verifique se há linhas de dados além do cabeçalho.');
    }

    console.log(`[processImport] Total de linhas extraídas: ${rows.length} (1 cabeçalho + ${rows.length - 1} linhas de dados)`);

    // 5. Detecta e faz parse dos dados
    console.log(`[processImport] Tentando detectar marketplace...`);
    console.log(`[processImport] Marketplace selecionado pelo usuário:`, marketplaceHint);
    console.log(`[processImport] Primeiras 3 linhas para debug:`, rows.slice(0, 3));

    const result = detectAndParse(rows, marketplaceHint);

    if (!result) {
      // Mostra informações detalhadas para ajudar no debug
      const headerRow = rows[0] || [];
      const headerText = headerRow.map((h: any) => String(h ?? '')).join(' | ');
      
      console.error('[processImport] ❌ Falha na detecção do marketplace');
      console.error('[processImport] Cabeçalho completo:', headerRow);
      console.error('[processImport] Cabeçalho (texto):', headerText);
      console.error('[processImport] Total de linhas:', rows.length);
      
      throw new Error(
        `Não foi possível identificar o marketplace da planilha.\n\n` +
        `Cabeçalho detectado: ${headerText.substring(0, 300)}\n\n` +
        `O sistema suporta:\n` +
        `1) Layouts nativos dos marketplaces (Mercado Livre, Shopee, Shein, TikTok);\n` +
        `2) Layouts agregadores (ex.: UpSeller), que tenham pelo menos:\n` +
        `   - Uma coluna de marketplace, como "Plataforma" (valores: "Mercado", "Shopee", "Shein", "TikTok"...)\n` +
        `   - Um identificador de pedido, como "Nº de Pedido de Plataforma"\n` +
        `   - Uma coluna de data (ex.: "Ordenado", "Liquidação", "Data", "Date", "Time")\n\n` +
        `Regra de aceitação: se houver Data + Pedido + Marketplace, a planilha é importada como agregador.\n` +
        `Se sua planilha segue esse padrão e o erro continuar, verifique grafia dos nomes das colunas ou envie um exemplo para ajuste fino do parser.`
      );
    }

    if (!result.normalizedData || result.normalizedData.length === 0) {
      // Mostra as colunas detectadas para ajudar no debug
      const headerRow = rows[0] || [];
      const headerText = headerRow.map((h: any) => String(h ?? '').trim()).filter(Boolean).slice(0, 15).join(', ');
      throw new Error(`Nenhum pedido válido encontrado. Marketplace: ${result.marketplaceName}. Colunas detectadas: ${headerText}. Verifique se existem colunas de ID do pedido e Data.`);
    }

    console.log(`[processImport] Marketplace detectado: ${result.marketplaceName}, ${result.normalizedData.length} pedidos normalizados`);

    // 6. Salva os dados no banco de dados
    const saveResult = await saveDataToDatabase(
      supabase,
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
