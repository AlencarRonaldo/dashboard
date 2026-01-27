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
    console.warn('Planilha vazia ou sem dados.');
    return null;
  }

  // Itera sobre a lista de parsers
  for (const [name, parser] of Object.entries(parsers)) {
    try {
      const normalizedData = parser.parse(rows);
      if (normalizedData) {
        return {
          marketplaceName: name as MarketplaceName,
          normalizedData,
        };
      }
    } catch (error) {
      console.error(`Erro ao tentar o parser '${name}':`, error);
    }
  }

  console.error('Nenhum parser compatível encontrado para a planilha.');
  return null;
}
