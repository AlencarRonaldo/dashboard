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
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
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
            <Bar dataKey="revenue" fill="#3B82F6" name="Faturamento" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" fill="#16A34A" name="Lucro" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
