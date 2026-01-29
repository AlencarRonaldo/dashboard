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
        <div className="w-full h-[280px] sm:h-[320px] lg:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number"
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis dataKey="store" type="category" width={80} />
            <Tooltip
              formatter={(value) => `${(value as number)?.toFixed(2) ?? 0}%`}
            />
            <Bar
              dataKey="margin"
              fill="hsl(var(--primary))"
              name="Margem (%)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
