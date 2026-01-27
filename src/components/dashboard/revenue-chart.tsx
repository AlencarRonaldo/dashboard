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
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
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
              formatter={(value: number) => [
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(value),
                ''
              ]}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#8884d8" 
              name="Faturamento"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#82ca9d" 
              name="Lucro"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
