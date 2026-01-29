'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MarketplaceChartProps {
  data: Array<{
    marketplace: string;
    revenue: number;
    profit: number;
  }>;
}

export function MarketplaceChart({ data }: MarketplaceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lucro por Marketplace</CardTitle>
        <CardDescription>
          Comparativo de faturamento e lucro entre marketplaces
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[280px] sm:h-[320px] lg:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="marketplace" />
            <YAxis 
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value) => [
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(value as number ?? 0),
                ''
              ]}
            />
            <Legend />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Faturamento" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" fill="hsl(var(--success))" name="Lucro" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
