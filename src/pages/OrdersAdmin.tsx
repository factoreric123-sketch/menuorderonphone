import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, ChevronDown, ChevronRight, RefreshCw, Search,
  ClipboardList, ChefHat, DollarSign, ShoppingBag, TrendingUp, XCircle,
  CheckCircle2, Printer, Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, parseISO, startOfDay, endOfDay, subDays } from 'date-fns';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type RestaurantTable = Database['public']['Tables']['restaurant_tables']['Row'];

interface OrderWithItems {
  order: Order;
  items: OrderItem[];
  tableLabel?: string;
}

const paymentStatusColor: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 border-green-500/20',
  unpaid: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  refunded: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const orderStatusColor: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  confirmed: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  preparing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ready: 'bg-green-500/10 text-green-600 border-green-500/20',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const OrdersAdmin = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('today');

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);

    const [{ data: restaurant }, { data: tablesData }] = await Promise.all([
      supabase.from('restaurants').select('name').eq('id', restaurantId).maybeSingle(),
      supabase.from('restaurant_tables').select('id, label').eq('restaurant_id', restaurantId),
    ]);

    if (restaurant?.name) setRestaurantName(restaurant.name);

    const tableMap: Record<string, string> = {};
    (tablesData as Pick<RestaurantTable, 'id' | 'label'>[] | null)?.forEach(t => {
      tableMap[t.id] = t.label;
    });

    const { data: allOrders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      toast.error('Failed to load orders');
      setLoading(false);
      return;
    }

    if (!allOrders?.length) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = allOrders.map(o => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at');

    const grouped: OrderWithItems[] = allOrders.map(order => ({
      order,
      items: (items || []).filter(i => i.order_id === order.id),
      tableLabel: order.table_id ? tableMap[order.table_id] : undefined,
    }));

    setOrders(grouped);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();
    if (!restaurantId) return;

    const channel = supabase
      .channel(`orders-admin-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, fetchOrders]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) toast.error('Failed to update status');
    else toast.success(`Order marked as ${status}`);
  };

  const updatePaymentStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ payment_status: status }).eq('id', orderId);
    if (error) toast.error('Failed to update payment');
    else toast.success(`Payment marked as ${status}`);
  };

  // Filter logic
  const activeOrders = useMemo(() =>
    orders.filter(o => !['completed', 'cancelled'].includes(o.order.status)),
  [orders]);

  const historyOrders = useMemo(() => {
    let filtered = orders.filter(o => ['completed', 'cancelled'].includes(o.order.status));

    // Date filter
    if (dateRange !== 'all') {
      const now = new Date();
      const start = dateRange === 'today' ? startOfDay(now) : startOfDay(subDays(now, dateRange === '7d' ? 7 : 30));
      filtered = filtered.filter(o => new Date(o.order.created_at) >= start);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.order.guest_name.toLowerCase().includes(q) ||
        o.order.id.slice(0, 8).toLowerCase().includes(q) ||
        o.items.some(i => i.dish_name.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [orders, dateRange, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const todayOrders = orders.filter(o => isToday(parseISO(o.order.created_at)));
    const completedToday = todayOrders.filter(o => o.order.status === 'completed');
    const totalRevenue = completedToday.reduce((sum, o) => sum + o.order.total_cents, 0);
    const avgOrder = completedToday.length > 0 ? totalRevenue / completedToday.length : 0;
    return {
      totalToday: todayOrders.length,
      completedToday: completedToday.length,
      revenue: totalRevenue,
      avgOrder,
      activeCount: activeOrders.length,
    };
  }, [orders, activeOrders]);

  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const printTicket = useCallback((entry: OrderWithItems) => {
    const w = window.open('', '_blank', 'width=420,height=760');
    if (!w) { toast.error('Allow pop-ups to print'); return; }
    const orderNum = entry.order.id.slice(0, 8).toUpperCase();
    const itemsHtml = entry.items.map(item => {
      const option = item.selected_option_name ? `<div class="meta">${escapeHtml(item.selected_option_name)}</div>` : '';
      const mods = item.selected_modifier_names?.length ? `<div class="meta">+ ${escapeHtml(item.selected_modifier_names.join(', '))}</div>` : '';
      const note = item.special_instructions ? `<div class="note">Note: ${escapeHtml(item.special_instructions)}</div>` : '';
      return `<div class="item"><div class="line"><span>${item.quantity}× ${escapeHtml(item.dish_name)}</span><span>${formatCurrency(item.subtotal_cents)}</span></div>${option}${mods}${note}</div>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Order ${orderNum}</title><style>body{font-family:monospace;margin:0;padding:16px}h1{font-size:16px;margin:0 0 4px}.item{border-top:1px dashed #000;padding:8px 0}.line{display:flex;justify-content:space-between;font-size:12px;font-weight:600}.meta,.note{font-size:11px;margin-top:2px}.total{border-top:1px dashed #000;margin-top:12px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700}</style></head><body><h1>${escapeHtml(restaurantName)}</h1><p>Order #${orderNum}</p><p>Guest: ${escapeHtml(entry.order.guest_name)}</p>${itemsHtml}<div class="total"><span>Total</span><span>${formatCurrency(entry.order.total_cents)}</span></div><script>setTimeout(()=>window.print(),150)</script></body></html>`;
    w.document.write(html);
    w.document.close();
  }, [restaurantName]);

  const OrderRow = ({ entry }: { entry: OrderWithItems }) => {
    const { order, items, tableLabel } = entry;
    const isExpanded = expandedIds.has(order.id);
    const orderNum = order.id.slice(0, 8).toUpperCase();
    const itemsSummary = items.length <= 2
      ? items.map(i => `${i.quantity}× ${i.dish_name}`).join(', ')
      : `${items[0].quantity}× ${items[0].dish_name} +${items.length - 1} more`;

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(order.id)}>
        <TableRow className="cursor-pointer" onClick={() => toggleExpand(order.id)}>
          <TableCell className="font-mono text-xs">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                #{orderNum}
              </button>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell className="font-medium">{order.guest_name}</TableCell>
          <TableCell>{tableLabel || '—'}</TableCell>
          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{itemsSummary}</TableCell>
          <TableCell className="font-semibold">{formatCurrency(order.total_cents)}</TableCell>
          <TableCell>
            <Badge variant="outline" className={`text-xs capitalize ${paymentStatusColor[order.payment_status] || ''}`}>
              {order.payment_status}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className={`text-xs capitalize ${orderStatusColor[order.status] || ''}`}>
              {order.status}
            </Badge>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
            {format(parseISO(order.created_at), 'MMM d, h:mm a')}
          </TableCell>
          <TableCell onClick={e => e.stopPropagation()}>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => printTicket(entry)} title="Print">
                <Printer className="h-4 w-4" />
              </Button>
              {order.payment_status === 'unpaid' && (
                <Button size="sm" variant="ghost" onClick={() => updatePaymentStatus(order.id, 'paid')} title="Mark Paid">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </Button>
              )}
              {!['completed', 'cancelled'].includes(order.status) && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => updateOrderStatus(order.id, 'completed')} title="Complete">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => updateOrderStatus(order.id, 'cancelled')} title="Cancel">
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
        <CollapsibleContent asChild>
          <tr>
            <td colSpan={9} className="p-0">
              <div className="bg-muted/30 border-t border-border p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Guest Info</p>
                    <p className="font-medium">{order.guest_name}</p>
                    {order.guest_phone && <p className="text-muted-foreground">{order.guest_phone}</p>}
                    {tableLabel && <p className="text-muted-foreground">Table: {tableLabel}</p>}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Payment</p>
                    <p className="capitalize">{order.payment_method.replace('_', ' ')}</p>
                    <p className="capitalize">{order.payment_status}</p>
                    {order.stripe_payment_intent_id && (
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        Stripe: {order.stripe_payment_intent_id.slice(0, 20)}…
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Order Notes</p>
                    <p>{order.notes || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Items</p>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="flex items-start justify-between bg-background rounded-lg p-3 border border-border">
                        <div>
                          <span className="font-medium">{item.quantity}× {item.dish_name}</span>
                          {item.selected_option_name && (
                            <p className="text-xs text-muted-foreground">{item.selected_option_name}</p>
                          )}
                          {item.selected_modifier_names?.length ? (
                            <p className="text-xs text-muted-foreground">+ {item.selected_modifier_names.join(', ')}</p>
                          ) : null}
                          {item.special_instructions && (
                            <p className="text-xs text-destructive font-medium mt-1">Note: {item.special_instructions}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{formatCurrency(item.subtotal_cents)}</span>
                          <Badge variant="outline" className={`ml-2 text-xs capitalize ${orderStatusColor[item.status] || ''}`}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const OrderTable = ({ data }: { data: OrderWithItems[] }) => (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Order</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Table</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                No orders found
              </TableCell>
            </TableRow>
          ) : (
            data.map(entry => <OrderRow key={entry.order.id} entry={entry} />)
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Order Management
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Store className="h-3.5 w-3.5" />
                {restaurantName || 'Restaurant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/${restaurantId}/tickets`)}>
              <ChefHat className="h-4 w-4 mr-1" /> Kitchen Board
            </Button>
            <Button variant="outline" size="sm" onClick={fetchOrders}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Orders', value: stats.activeCount, icon: ShoppingBag, color: 'text-blue-500' },
            { label: 'Orders Today', value: stats.totalToday, icon: ClipboardList, color: 'text-foreground' },
            { label: "Today's Revenue", value: formatCurrency(stats.revenue), icon: DollarSign, color: 'text-green-600' },
            { label: 'Avg Order', value: formatCurrency(stats.avgOrder), icon: TrendingUp, color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border p-4 bg-card">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <s.icon className="h-4 w-4" />
                {s.label}
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Active Orders ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Order History ({historyOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <OrderTable data={activeOrders} />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by guest, order #, or item..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                {(['today', '7d', '30d', 'all'] as const).map(range => (
                  <Button
                    key={range}
                    variant={dateRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateRange(range)}
                  >
                    {range === 'today' ? 'Today' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
                  </Button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <OrderTable data={historyOrders} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default OrdersAdmin;
