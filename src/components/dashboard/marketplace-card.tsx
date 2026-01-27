import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketplaceCardProps {
  marketplace: string;
  revenue: number;
  profit: number;
  orders: number;
  margin: number;
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
  trend,
}: MarketplaceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{marketplace}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-2xl font-bold">{formatCurrency(revenue)}</div>
          <p className="text-xs text-muted-foreground">Faturamento Total</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-semibold">{formatCurrency(profit)}</div>
            <p className="text-xs text-muted-foreground">Lucro</p>
          </div>
          <div>
            <div className="text-lg font-semibold">{orders}</div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <div className="text-sm font-medium">{margin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Margem</p>
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
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
