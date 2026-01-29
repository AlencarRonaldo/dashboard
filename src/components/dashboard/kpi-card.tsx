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
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    border: 'border-l-4 border-l-green-500',
    icon: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
  },
  emerald: {
    border: 'border-l-4 border-l-emerald-500',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  purple: {
    border: 'border-l-4 border-l-purple-500',
    icon: 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    value: 'text-purple-700 dark:text-purple-300',
  },
  orange: {
    border: 'border-l-4 border-l-orange-500',
    icon: 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
    value: 'text-orange-700 dark:text-orange-300',
  },
  pink: {
    border: 'border-l-4 border-l-pink-500',
    icon: 'bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400',
    value: 'text-pink-700 dark:text-pink-300',
  },
  indigo: {
    border: 'border-l-4 border-l-indigo-700',
    icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
    value: 'text-indigo-800 dark:text-indigo-300',
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
        <div className={`text-2xl font-bold ${styles?.value ?? ''}`}>{value}</div>
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
