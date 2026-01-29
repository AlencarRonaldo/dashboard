'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Order {
  id: string;
  platform_order_id: string;
  external_order_id?: string;
  date: string;
  marketplace: string;
  store: string;
  sku: string;
  revenue: number;
  profit: number;
  margin: number;
}

interface OrdersTableProps {
  orders: Order[];
}

export function OrdersTable({ orders: initialOrders }: OrdersTableProps) {
  const [orders] = useState<Order[]>(initialOrders);
  const [filters, setFilters] = useState({
    marketplace: '',
    store: '',
    orderId: '',
    dateFrom: '',
    dateTo: '',
  });

  const marketplaces = Array.from(new Set(orders.map(o => o.marketplace)));
  const stores = Array.from(new Set(orders.map(o => o.store)));

  const filteredOrders = orders.filter(order => {
    if (filters.marketplace && order.marketplace !== filters.marketplace) return false;
    if (filters.store && order.store !== filters.store) return false;
    if (filters.orderId) {
      const search = filters.orderId.toLowerCase();
      const matchPlatform = order.platform_order_id?.toLowerCase().includes(search);
      const matchExternal = order.external_order_id?.toLowerCase().includes(search);
      if (!matchPlatform && !matchExternal) return false;
    }
    if (filters.dateFrom && new Date(order.date) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(order.date) > new Date(filters.dateTo)) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Pedidos Detalhados</CardTitle>
        <CardDescription>
          Lista completa de pedidos com filtros avançados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <Select
            value={filters.marketplace}
            onChange={(e) => setFilters({ ...filters, marketplace: e.target.value })}
          >
            <option value="">Todos os Marketplaces</option>
            {marketplaces.map(mp => (
              <option key={mp} value={mp}>{mp}</option>
            ))}
          </Select>
          
          <Select
            value={filters.store}
            onChange={(e) => setFilters({ ...filters, store: e.target.value })}
          >
            <option value="">Todas as Lojas</option>
            {stores.map(store => (
              <option key={store} value={store}>{store}</option>
            ))}
          </Select>
          
          <Input
            placeholder="Buscar por Nº do Pedido..."
            value={filters.orderId}
            onChange={(e) => setFilters({ ...filters, orderId: e.target.value })}
            className="sm:col-span-2 lg:col-span-1"
          />
          
          <Input
            type="date"
            placeholder="Data inicial"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          />
          
          <Input
            type="date"
            placeholder="Data final"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum pedido encontrado
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-foreground">
                    {order.platform_order_id || order.external_order_id || '-'}
                  </span>
                  <span className="text-sm font-medium text-foreground">{order.marketplace}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Data:</span>
                    <span className="ml-1 text-foreground">{formatDate(order.date)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loja:</span>
                    <span className="ml-1 text-foreground">{order.store}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Faturamento:</span>
                    <span className="ml-1 font-semibold text-foreground">{formatCurrency(order.revenue)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lucro:</span>
                    <span className="ml-1 font-semibold text-success">{formatCurrency(order.profit)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border flex justify-between text-sm">
                  <span className="text-muted-foreground">Margem</span>
                  <span className="font-medium text-foreground">{order.margin.toFixed(2)}%</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: tabela com scroll horizontal */}
        <div className="hidden md:block rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-semibold text-foreground whitespace-nowrap">Nº Pedido Plataforma</th>
                  <th className="h-12 px-4 text-left align-middle font-semibold text-foreground whitespace-nowrap">Nº Pedido UpSeller</th>
                  <th className="h-12 px-4 text-left align-middle font-semibold text-foreground whitespace-nowrap">Data</th>
                  <th className="h-12 px-4 text-left align-middle font-semibold text-foreground whitespace-nowrap">Marketplace</th>
                  <th className="h-12 px-4 text-left align-middle font-semibold text-foreground whitespace-nowrap">Loja</th>
                  <th className="h-12 px-4 text-right align-middle font-semibold text-foreground whitespace-nowrap">Faturamento</th>
                  <th className="h-12 px-4 text-right align-middle font-semibold text-foreground whitespace-nowrap">Lucro</th>
                  <th className="h-12 px-4 text-right align-middle font-semibold text-foreground whitespace-nowrap">Margem</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum pedido encontrado
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`
                        border-b border-border transition-colors
                        ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'}
                        hover:bg-muted/50
                      `}
                    >
                      <td className="p-4 align-middle font-mono text-sm text-foreground">{order.platform_order_id || '-'}</td>
                      <td className="p-4 align-middle font-mono text-sm text-muted-foreground">{order.external_order_id || '-'}</td>
                      <td className="p-4 align-middle text-foreground">{formatDate(order.date)}</td>
                      <td className="p-4 align-middle text-foreground font-medium">{order.marketplace}</td>
                      <td className="p-4 align-middle text-foreground">{order.store}</td>
                      <td className="p-4 align-middle text-right font-semibold text-foreground">{formatCurrency(order.revenue)}</td>
                      <td className="p-4 align-middle text-right font-semibold text-success">{formatCurrency(order.profit)}</td>
                      <td className="p-4 align-middle text-right font-medium text-foreground">{order.margin.toFixed(2)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Mostrando {filteredOrders.length} de {orders.length} pedidos
        </div>
      </CardContent>
    </Card>
  );
}
