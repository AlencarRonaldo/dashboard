import { MarketplaceName, NormalizedOrder } from '../types';
import meliParser from './meli';
import shopeeParser from './shopee';
import sheinParser from './shein';
import tiktokParser from './tiktok';

// Mapeia os nomes dos marketplaces para suas respectivas implementações de parser
const parsers = {
  meli: meliParser,
  shopee: shopeeParser,
  shein: sheinParser,
  tiktok: tiktokParser,
};

// Resultado da detecção e do parsing
interface ParserResult {
  marketplaceName: MarketplaceName;
  normalizedData: NormalizedOrder[];
}

/**
 * Tenta identificar o marketplace e fazer o parsing dos dados da planilha.
 */
export function detectAndParse(rows: any[][]): ParserResult | null {
  if (!rows || rows.length === 0) {
    console.warn('[detectAndParse] Planilha vazia ou sem dados.');
    return null;
  }

  // Mostra o cabeçalho para debug
  if (rows.length > 0) {
    const headerRow = rows[0];
    console.log('[detectAndParse] Cabeçalho da planilha:', headerRow);
    console.log('[detectAndParse] Cabeçalho (normalizado):', headerRow.map((h: any) => String(h || '').toLowerCase().trim()));
  }

  // Itera sobre a lista de parsers
  const parserNames = Object.keys(parsers);
  console.log(`[detectAndParse] Tentando ${parserNames.length} parsers: ${parserNames.join(', ')}`);
  
  for (const [name, parser] of Object.entries(parsers)) {
    try {
      console.log(`[detectAndParse] Tentando parser: ${name}...`);
      const normalizedData = parser.parse(rows);
      if (normalizedData) {
        console.log(`[detectAndParse] ✅ Marketplace identificado: ${name} (${normalizedData.length} pedidos)`);
        return {
          marketplaceName: name as MarketplaceName,
          normalizedData,
        };
      } else {
        console.log(`[detectAndParse] Parser ${name} não identificou a planilha`);
      }
    } catch (error: any) {
      console.error(`[detectAndParse] Erro ao tentar o parser '${name}':`, error?.message || error);
      console.error(`[detectAndParse] Stack do parser ${name}:`, error?.stack);
    }
  }

  console.error('[detectAndParse] ❌ Nenhum parser compatível encontrado para a planilha.');
  console.error('[detectAndParse] Cabeçalho recebido:', rows[0]);
  console.error('[detectAndParse] Total de linhas:', rows.length);
  return null;
}
