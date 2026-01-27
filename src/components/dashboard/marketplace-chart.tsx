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
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="marketplace" />
            <YAxis 
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              formatter={(value: number) => [
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(value),
                ''
              ]}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#8884d8" name="Faturamento" />
            <Bar dataKey="profit" fill="#82ca9d" name="Lucro" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
