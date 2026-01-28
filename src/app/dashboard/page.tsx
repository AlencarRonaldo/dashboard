'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { MarketplaceCard } from '@/components/dashboard/marketplace-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { MarketplaceChart } from '@/components/dashboard/marketplace-chart';
import { MarginChart } from '@/components/dashboard/margin-chart';
import { OrdersTable } from '@/components/dashboard/orders-table';
import { Select } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

interface DashboardData {
  kpis: {
    totalRevenue: number;
    netRevenue: number;
    totalProfit: number;
    averageMargin: number;
    totalOrders: number;
    averageTicket: number;
  };
  marketplaceStats: Array<{
    marketplace: string;
    marketplaceName: string;
    revenue: number;
    profit: number;
    orders: number;
    margin: number;
    totalFees?: number;
    trend: { value: number; isPositive: boolean };
  }>;
  revenueData: Array<{ date: string; revenue: number; profit: number }>;
  marketplaceData: Array<{ marketplace: string; revenue: number; profit: number }>;
  marginData: Array<{ store: string; margin: number }>;
  orders: Array<{
    id: string;
    platform_order_id: string;
    date: string;
    marketplace: string;
    store: string;
    sku: string;
    revenue: number;
    profit: number;
    margin: number;
  }>;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/dashboard');
        const text = await response.text();

        if (!response.ok) {
          throw new Error(`Erro ao buscar dados: ${response.status}`);
        }

        let jsonData;
        try {
          jsonData = JSON.parse(text);
        } catch (parseError) {
          throw new Error('Resposta inválida do servidor');
        }

        setData(jsonData);
      } catch (err: any) {
        console.error('Erro ao carregar dashboard:', err);
        setError(err.message || 'Erro ao carregar dados do dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive">Erro: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </div>
      </div>
    );
  }

  const {
    kpis,
    marketplaceStats,
    revenueData,
    marketplaceData,
    marginData,
    orders,
  } = data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="p-4 md:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das suas vendas</p>
        </div>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'day' | 'month')}
          className="w-40"
        >
          <option value="day">Por Dia</option>
          <option value="month">Por Mês</option>
        </Select>
      </div>

      {/* Métricas Gerais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <KpiCard
          title="Faturamento Total"
          value={formatCurrency(kpis.totalRevenue)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          description="Período selecionado"
          trend={{ value: 0, isPositive: true }}
        />
        <KpiCard
          title="Receita Líquida"
          value={formatCurrency(kpis.netRevenue)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          description="Após descontos"
          trend={{ value: 0, isPositive: true }}
        />
        <KpiCard
          title="Lucro Total"
          value={formatCurrency(kpis.totalProfit)}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description="Lucro líquido"
          trend={{ value: 0, isPositive: kpis.totalProfit >= 0 }}
        />
        <KpiCard
          title="Margem Média"
          value={`${kpis.averageMargin.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description="Margem de lucro"
          trend={{ value: 0, isPositive: kpis.averageMargin >= 0 }}
        />
        <KpiCard
          title="Total de Pedidos"
          value={kpis.totalOrders}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          description="No período"
          trend={{ value: 0, isPositive: true }}
        />
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(kpis.averageTicket)}
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
          description="Por pedido"
          trend={{ value: 0, isPositive: true }}
        />
      </div>

      {/* Cards por Marketplace */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Por Marketplace</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {marketplaceStats.map((stats) => (
            <MarketplaceCard
              key={stats.marketplace}
              marketplace={stats.marketplace}
              revenue={stats.revenue}
              profit={stats.profit}
              orders={stats.orders}
              margin={stats.margin}
              totalFees={stats.totalFees}
              totalRevenue={kpis.totalRevenue}
              trend={stats.trend}
            />
          ))}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart data={revenueData} period={period} />
        <MarketplaceChart data={marketplaceData} />
      </div>

      <MarginChart data={marginData} />

      {/* Tabela de Pedidos */}
      <OrdersTable orders={orders} />
    </main>
  );
}
