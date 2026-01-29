'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    profit: number;
  }>;
  period?: 'day' | 'month';
}

export function RevenueChart({ data, period = 'day' }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturamento por Período</CardTitle>
        <CardDescription>
          Evolução do faturamento e lucro ao longo do tempo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[280px] sm:h-[320px] lg:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => {
                if (period === 'month') {
                  return new Date(value).toLocaleDateString('pt-BR', { month: 'short' });
                }
                return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              }}
            />
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
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--primary))"
              name="Faturamento"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="hsl(var(--success))"
              name="Lucro"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--success))', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
