'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Order {
  id: string;
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
    sku: '',
    dateFrom: '',
    dateTo: '',
  });

  const marketplaces = Array.from(new Set(orders.map(o => o.marketplace)));
  const stores = Array.from(new Set(orders.map(o => o.store)));

  const filteredOrders = orders.filter(order => {
    if (filters.marketplace && order.marketplace !== filters.marketplace) return false;
    if (filters.store && order.store !== filters.store) return false;
    if (filters.sku && !order.sku.toLowerCase().includes(filters.sku.toLowerCase())) return false;
    if (filters.dateFrom && new Date(order.date) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(order.date) > new Date(filters.dateTo)) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos Detalhados</CardTitle>
        <CardDescription>
          Lista completa de pedidos com filtros avançados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
            placeholder="Buscar por SKU..."
            value={filters.sku}
            onChange={(e) => setFilters({ ...filters, sku: e.target.value })}
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

        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left align-middle font-medium">Data</th>
                  <th className="h-12 px-4 text-left align-middle font-medium">Marketplace</th>
                  <th className="h-12 px-4 text-left align-middle font-medium">Loja</th>
                  <th className="h-12 px-4 text-left align-middle font-medium">SKU</th>
                  <th className="h-12 px-4 text-right align-middle font-medium">Faturamento</th>
                  <th className="h-12 px-4 text-right align-middle font-medium">Lucro</th>
                  <th className="h-12 px-4 text-right align-middle font-medium">Margem</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhum pedido encontrado
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">{formatDate(order.date)}</td>
                      <td className="p-4 align-middle">{order.marketplace}</td>
                      <td className="p-4 align-middle">{order.store}</td>
                      <td className="p-4 align-middle font-mono text-sm">{order.sku}</td>
                      <td className="p-4 align-middle text-right">{formatCurrency(order.revenue)}</td>
                      <td className="p-4 align-middle text-right">{formatCurrency(order.profit)}</td>
                      <td className="p-4 align-middle text-right">{order.margin.toFixed(2)}%</td>
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
