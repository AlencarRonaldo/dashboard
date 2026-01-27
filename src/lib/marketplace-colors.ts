/**
 * Cores e configurações visuais por marketplace
 * Usado para manter consistência visual em todo o dashboard
 */

export interface MarketplaceColorConfig {
  primary: string;
  hover: string;
  bg: string;
  text: string;
  border: string;
}

export const marketplaceColors: Record<string, MarketplaceColorConfig> = {
  'Mercado Livre': {
    primary: '#FFE135',
    hover: '#FFD700',
    bg: '#FFF9E6',
    text: '#856404',
    border: '#FFE135',
  },
  'Shopee': {
    primary: '#EE4D2D',
    hover: '#DC3D1D',
    bg: '#FFF4F0',
    text: '#7C2D12',
    border: '#EE4D2D',
  },
  'Shein': {
    primary: '#1F2937',
    hover: '#111827',
    bg: '#F3F4F6',
    text: '#FFFFFF',
    border: '#1F2937',
  },
  'TikTok Shop': {
    primary: '#00F2EA',
    hover: '#00D9D2',
    bg: '#E6FFFE',
    text: '#065F46',
    border: '#00F2EA',
  },
};

/**
 * Retorna a configuração de cores para um marketplace
 */
export function getMarketplaceColors(marketplace: string): MarketplaceColorConfig {
  return marketplaceColors[marketplace] || {
    primary: '#6B7280',
    hover: '#4B5563',
    bg: '#F9FAFB',
    text: '#1F2937',
    border: '#E5E7EB',
  };
}

/**
 * Cores para gráficos (paleta limitada a 6 cores)
 */
export const chartColors = {
  meli: '#FFE135',
  shopee: '#EE4D2D',
  shein: '#1F2937',
  tiktok: '#00F2EA',
  total: '#3B82F6', // Azul para total consolidado
  average: '#9CA3AF', // Cinza para médias/referências
};

/**
 * Cores semânticas para BI
 */
export const semanticColors = {
  success: '#16A34A', // Verde - lucro, crescimento
  danger: '#DC2626', // Vermelho - prejuízo, queda
  warning: '#F59E0B', // Amarelo - atenção
  info: '#3B82F6', // Azul - informação
  neutral: '#6B7280', // Cinza - neutro
};
