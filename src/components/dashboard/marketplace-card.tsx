import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMarketplaceColors } from '@/lib/marketplace-colors';

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
  const colors = getMarketplaceColors(marketplace);

  return (
    <Card
      className="relative overflow-hidden border-l-4 bg-card text-card-foreground"
      style={{ borderLeftColor: colors.border }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: colors.bg,
              color: colors.text,
            }}
          >
            {marketplace}
          </span>
        </CardTitle>
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
