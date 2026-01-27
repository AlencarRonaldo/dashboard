'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MarginChartProps {
  data: Array<{
    store: string;
    margin: number;
  }>;
}

export function MarginChart({ data }: MarginChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Margem de Lucro por Loja</CardTitle>
        <CardDescription>
          Percentual de margem de lucro por loja
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis 
              type="number"
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis dataKey="store" type="category" width={100} />
            <Tooltip 
              formatter={(value: number) => `${value.toFixed(2)}%`}
            />
            <Bar dataKey="margin" fill="#8B5CF6" name="Margem (%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
