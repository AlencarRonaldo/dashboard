import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketplaceCardProps {
  marketplace: string;
  revenue: number;
  profit: number;
  orders: number;
  margin: number;
  totalFees?: number; // Total de taxas (fees + commissions)
  totalRevenue?: number; // Faturamento total de todas as vendas
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

// Mapeamento de cores por marketplace
const marketplaceColors: Record<string, { primary: string; bg: string; border: string }> = {
  'Mercado Livre': {
    primary: '#FFE135',
    bg: '#FFF9E6',
    border: '#FFE135',
  },
  'Shopee': {
    primary: '#EE4D2D',
    bg: '#FFF4F0',
    border: '#EE4D2D',
  },
  'Shein': {
    primary: '#1F2937',
    bg: '#F3F4F6',
    border: '#1F2937',
  },
  'TikTok Shop': {
    primary: '#00F2EA',
    bg: '#E6FFFE',
    border: '#00F2EA',
  },
};

export function MarketplaceCard({
  marketplace,
  revenue,
  profit,
  orders,
  margin,
  totalFees = 0,
  totalRevenue,
  trend,
}: MarketplaceCardProps) {
  const colors = marketplaceColors[marketplace] || {
    primary: '#6B7280',
    bg: '#F9FAFB',
    border: '#E5E7EB',
  };

  return (
    <Card className="relative overflow-hidden border-l-4" style={{ borderLeftColor: colors.border }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{marketplace}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(revenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Faturamento</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-semibold text-success">{formatCurrency(profit)}</div>
            <p className="text-xs text-muted-foreground">Lucro</p>
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">{orders}</div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
          </div>
        </div>
        
        {totalFees > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="text-sm font-medium text-muted-foreground">
              <span className="text-xs">Total de Taxas: </span>
              <span className="text-destructive font-semibold">{formatCurrency(totalFees)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <div className="text-sm font-medium text-foreground">{margin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Margem</p>
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
