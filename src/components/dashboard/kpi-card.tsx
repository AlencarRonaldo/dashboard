import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /** Cor de destaque do card: blue, green, emerald, purple, orange, pink, indigo */
  accent?: 'blue' | 'green' | 'emerald' | 'purple' | 'orange' | 'pink' | 'indigo';
}

const accentStyles = {
  blue: {
    border: 'border-l-4 border-l-blue-500',
    icon: 'bg-blue-500 text-white',
    value: 'text-foreground',
  },
  green: {
    border: 'border-l-4 border-l-green-500',
    icon: 'bg-green-500 text-white',
    value: 'text-foreground',
  },
  emerald: {
    border: 'border-l-4 border-l-emerald-500',
    icon: 'bg-emerald-500 text-white',
    value: 'text-foreground',
  },
  purple: {
    border: 'border-l-4 border-l-purple-500',
    icon: 'bg-purple-500 text-white',
    value: 'text-foreground',
  },
  orange: {
    border: 'border-l-4 border-l-orange-500',
    icon: 'bg-orange-500 text-white',
    value: 'text-foreground',
  },
  pink: {
    border: 'border-l-4 border-l-pink-500',
    icon: 'bg-pink-500 text-white',
    value: 'text-foreground',
  },
  indigo: {
    border: 'border-l-4 border-l-indigo-700',
    icon: 'bg-indigo-700 text-white',
    value: 'text-foreground',
  },
};

export function KpiCard({ title, value, icon, description, trend, accent }: KpiCardProps) {
  const styles = accent ? accentStyles[accent] : null;

  return (
    <Card className={styles?.border}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && (
          <div className={`rounded-md p-1.5 ${styles?.icon ?? ''}`}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold sm:text-2xl ${styles?.value ?? ''}`}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${trend.isPositive ? 'text-success' : 'text-destructive'}`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value).toFixed(1)}%</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
