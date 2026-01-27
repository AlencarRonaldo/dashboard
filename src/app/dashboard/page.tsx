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

// Dados mockados - substitua pela chamada à API
const mockOrders = [
  {
    id: '1',
    date: '2024-01-15',
    marketplace: 'Mercado Livre',
    store: 'Loja A',
    sku: 'SKU-001',
    revenue: 1500,
    profit: 450,
    margin: 30,
  },
  {
    id: '2',
    date: '2024-01-16',
    marketplace: 'Shopee',
    store: 'Loja B',
    sku: 'SKU-002',
    revenue: 2300,
    profit: 690,
    margin: 30,
  },
  {
    id: '3',
    date: '2024-01-17',
    marketplace: 'Mercado Livre',
    store: 'Loja A',
    sku: 'SKU-003',
    revenue: 1800,
    profit: 540,
    margin: 30,
  },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carregamento de dados
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  // Calcular métricas dos dados mockados
  const totalRevenue = mockOrders.reduce((sum, order) => sum + order.revenue, 0);
  const totalProfit = mockOrders.reduce((sum, order) => sum + order.profit, 0);
  const netRevenue = totalRevenue - totalProfit; // Simulação
  const averageMargin = mockOrders.reduce((sum, order) => sum + order.margin, 0) / mockOrders.length;
  const totalOrders = mockOrders.length;
  const averageTicket = totalRevenue / totalOrders;

  // Dados para gráficos
  const revenueData = [
    { date: '2024-01-15', revenue: 1500, profit: 450 },
    { date: '2024-01-16', revenue: 2300, profit: 690 },
    { date: '2024-01-17', revenue: 1800, profit: 540 },
    { date: '2024-01-18', revenue: 2100, profit: 630 },
    { date: '2024-01-19', revenue: 1900, profit: 570 },
  ];

  const marketplaceData = [
    { marketplace: 'Mercado Livre', revenue: 3300, profit: 990 },
    { marketplace: 'Shopee', revenue: 2300, profit: 690 },
    { marketplace: 'TikTok Shop', revenue: 1500, profit: 450 },
  ];

  // Dados detalhados por marketplace para os cards
  const marketplaceStats = [
    {
      marketplace: 'Mercado Livre',
      revenue: 3300,
      profit: 990,
      orders: 45,
      margin: 30.0,
      trend: { value: 15.2, isPositive: true },
    },
    {
      marketplace: 'Shopee',
      revenue: 2300,
      profit: 690,
      orders: 32,
      margin: 30.0,
      trend: { value: 8.5, isPositive: true },
    },
    {
      marketplace: 'TikTok Shop',
      revenue: 1500,
      profit: 450,
      orders: 18,
      margin: 30.0,
      trend: { value: -3.2, isPositive: false },
    },
    {
      marketplace: 'Shein',
      revenue: 1200,
      profit: 360,
      orders: 15,
      margin: 30.0,
      trend: { value: 12.1, isPositive: true },
    },
  ];

  const marginData = [
    { store: 'Loja A', margin: 30.5 },
    { store: 'Loja B', margin: 28.2 },
    { store: 'Loja C', margin: 32.1 },
  ];

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
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          description="Período selecionado"
          trend={{ value: 20.1, isPositive: true }}
        />
        <KpiCard
          title="Receita Líquida"
          value={formatCurrency(netRevenue)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          description="Após descontos"
          trend={{ value: 15.2, isPositive: true }}
        />
        <KpiCard
          title="Lucro Total"
          value={formatCurrency(totalProfit)}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description="Lucro líquido"
          trend={{ value: 18.5, isPositive: true }}
        />
        <KpiCard
          title="Margem Média"
          value={`${averageMargin.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description="Margem de lucro"
          trend={{ value: 2.3, isPositive: true }}
        />
        <KpiCard
          title="Total de Pedidos"
          value={totalOrders}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          description="No período"
          trend={{ value: 5.5, isPositive: true }}
        />
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(averageTicket)}
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
          description="Por pedido"
          trend={{ value: -2.1, isPositive: false }}
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
      <OrdersTable orders={mockOrders} />
    </main>
  );
}
