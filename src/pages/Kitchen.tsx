import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, ChefHat, CheckCircle2, RefreshCw, Printer, Store, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type RestaurantTable = Database['public']['Tables']['restaurant_tables']['Row'];

interface TicketGroup {
  order: Order;
  items: OrderItem[];
  tableLabel?: string;
}

interface VisibleTicket extends TicketGroup {
  visibleItems: OrderItem[];
}

const STATIONS = ['all', 'kitchen', 'bar', 'dessert'] as const;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  confirmed: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  preparing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ready: 'bg-green-500/10 text-green-600 border-green-500/20',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const Kitchen = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketGroup[]>([]);
  const [activeStation, setActiveStation] = useState('all');
  const [restaurantName, setRestaurantName] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);

    const statuses = showCompleted
      ? ['pending', 'confirmed', 'preparing', 'ready', 'completed']
      : ['pending', 'confirmed', 'preparing', 'ready'];

    const [{ data: restaurant }, { data: tablesData }, { data: orders, error: ordersError }] = await Promise.all([
      supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .maybeSingle(),
      supabase
        .from('restaurant_tables')
        .select('id, label')
        .eq('restaurant_id', restaurantId),
      supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('status', statuses)
        .order('created_at', { ascending: true }),
    ]);

    if (restaurant?.name) {
      setRestaurantName(restaurant.name);
    }

    if (ordersError) {
      toast.error('Failed to load tickets');
      setLoading(false);
      return;
    }

    const tableMap: Record<string, string> = {};
    (tablesData as Pick<RestaurantTable, 'id' | 'label'>[] | null)?.forEach((table) => {
      tableMap[table.id] = table.label;
    });

    if (!orders?.length) {
      setTickets([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map((order) => order.id);
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at');

    if (itemsError) {
      toast.error('Failed to load ticket items');
      setLoading(false);
      return;
    }

    const grouped: TicketGroup[] = orders.map((order) => ({
      order,
      items: (items || []).filter((item) => item.order_id === order.id),
      tableLabel: order.table_id ? tableMap[order.table_id] : undefined,
    }));

    setTickets(grouped);
    setLoading(false);
  }, [restaurantId, showCompleted]);

  useEffect(() => {
    fetchData();

    if (!restaurantId) return;

    const channel = supabase
      .channel(`kitchen-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, fetchData]);

  const cycleItemStatus = async (itemId: string, current: string) => {
    const next = current === 'pending' ? 'preparing' : current === 'preparing' ? 'ready' : 'pending';
    const { error } = await supabase.from('order_items').update({ status: next }).eq('id', itemId);
    if (error) {
      toast.error('Failed to update item status');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) {
      toast.error('Failed to update order status');
      return;
    }
    toast.success(`Order marked as ${status}`);
  };

  const filteredTickets: VisibleTicket[] = useMemo(
    () => tickets
      .map((ticket) => ({
        ...ticket,
        visibleItems:
          activeStation === 'all'
            ? ticket.items
            : ticket.items.filter((item) => item.station === activeStation),
      }))
      .filter((ticket) => ticket.visibleItems.length > 0),
    [tickets, activeStation],
  );

  const summary = useMemo(() => ({
    pending: tickets.filter((ticket) => ticket.order.status === 'pending').length,
    preparing: tickets.filter((ticket) => ticket.order.status === 'preparing').length,
    ready: tickets.filter((ticket) => ticket.order.status === 'ready').length,
  }), [tickets]);

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const printTicket = useCallback((ticket: TicketGroup) => {
    const openedWindow = window.open('', '_blank', 'width=420,height=760');
    if (!openedWindow) {
      toast.error('Allow pop-ups to print tickets');
      return;
    }

    const printedAt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(ticket.order.created_at));
    const orderNumber = ticket.order.id.slice(0, 8).toUpperCase();
    const itemsHtml = ticket.items.map((item) => {
      const option = item.selected_option_name
        ? `<div class="meta">${escapeHtml(item.selected_option_name)}</div>`
        : '';
      const modifiers = item.selected_modifier_names?.length
        ? `<div class="meta">+ ${escapeHtml(item.selected_modifier_names.join(', '))}</div>`
        : '';
      const instructions = item.special_instructions
        ? `<div class="note">Note: ${escapeHtml(item.special_instructions)}</div>`
        : '';

      return `
        <div class="item">
          <div class="line">
            <span>${item.quantity} x ${escapeHtml(item.dish_name)}</span>
            <span>${formatCurrency(item.subtotal_cents)}</span>
          </div>
          ${option}
          ${modifiers}
          ${instructions}
        </div>
      `;
    }).join('');

    const notes = ticket.order.notes
      ? `<div class="section"><strong>Order Notes:</strong><br/>${escapeHtml(ticket.order.notes)}</div>`
      : '';
    const tableRow = ticket.tableLabel
      ? `<div><strong>Table:</strong> ${escapeHtml(ticket.tableLabel)}</div>`
      : '';
    const phoneRow = ticket.order.guest_phone
      ? `<div><strong>Phone:</strong> ${escapeHtml(ticket.order.guest_phone)}</div>`
      : '';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Ticket ${orderNumber}</title>
          <style>
            body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; padding: 16px; color: #000; }
            .ticket { max-width: 340px; margin: 0 auto; }
            .heading { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .heading h1 { font-size: 16px; margin: 0 0 4px 0; }
            .heading p { margin: 0; font-size: 12px; }
            .section { margin: 10px 0; font-size: 12px; line-height: 1.4; }
            .item { border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
            .line { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 600; }
            .meta { font-size: 11px; margin-top: 2px; }
            .note { font-size: 11px; margin-top: 4px; font-weight: 600; }
            .total { border-top: 1px dashed #000; margin-top: 12px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="heading">
              <h1>${escapeHtml(restaurantName || 'Restaurant Ticket')}</h1>
              <p>Order #${orderNumber}</p>
              <p>${printedAt}</p>
            </div>
            <div class="section">
              <div><strong>Guest:</strong> ${escapeHtml(ticket.order.guest_name)}</div>
              ${tableRow}
              ${phoneRow}
              <div><strong>Status:</strong> ${escapeHtml(ticket.order.status)}</div>
            </div>
            ${notes}
            <div class="section">${itemsHtml}</div>
            <div class="total">
              <span>Total</span>
              <span>${formatCurrency(ticket.order.total_cents)}</span>
            </div>
          </div>
          <script>
            window.focus();
            setTimeout(() => window.print(), 150);
          </script>
        </body>
      </html>
    `;

    openedWindow.document.write(html);
    openedWindow.document.close();
  }, [restaurantName]);

  const getAdvanceLabel = (status: string) => {
    if (status === 'pending') return 'Confirm';
    if (status === 'confirmed') return 'Start Prep';
    if (status === 'preparing') return 'Mark Ready';
    return 'Keep Ready';
  };

  const getAdvanceStatus = (status: string) => {
    if (status === 'pending') return 'confirmed';
    if (status === 'confirmed') return 'preparing';
    if (status === 'preparing') return 'ready';
    return 'ready';
  };

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
                <ChefHat className="h-5 w-5" /> Ticket Dashboard
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Store className="h-3.5 w-3.5" />
                {restaurantName || 'Restaurant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/${restaurantId}/orders`)}>
              <ClipboardList className="h-4 w-4 mr-1" /> Orders
            </Button>
            <Button
              variant={showCompleted ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCompleted((prev) => !prev)}
            >
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Station Tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {STATIONS.map((station) => (
            <Button
              key={station}
              variant={activeStation === station ? 'default' : 'outline'}
              size="sm"
              className="capitalize rounded-full"
              onClick={() => setActiveStation(station)}
            >
              {station}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">Pending: {summary.pending}</Badge>
          <Badge variant="outline" className="text-xs">Preparing: {summary.preparing}</Badge>
          <Badge variant="outline" className="text-xs">Ready: {summary.ready}</Badge>
        </div>
      </div>

      {/* Tickets */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {showCompleted ? 'No tickets found' : 'No active tickets'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTickets.map((ticket) => {
              const { order, tableLabel, visibleItems } = ticket;
              return (
                <div key={order.id} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                {/* Ticket header */}
                <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <div>
                    <span className="font-semibold text-foreground">{order.guest_name}</span>
                    {tableLabel && <Badge variant="outline" className="ml-2 text-xs">{tableLabel}</Badge>}
                    <Badge variant="outline" className="ml-2 text-xs font-mono">
                      #{order.id.slice(0, 8)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className={`text-xs capitalize ${statusColors[order.status] || ''}`}>
                      {order.status}
                    </Badge>
                    <Clock className="h-3 w-3" />
                    {timeAgo(order.created_at)}
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-border">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      className="w-full text-left p-3 hover:bg-accent/50 transition-colors"
                      onClick={() => cycleItemStatus(item.id, item.status)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-foreground">{item.quantity}× {item.dish_name}</span>
                          {item.selected_option_name && <p className="text-xs text-muted-foreground">{item.selected_option_name}</p>}
                          {item.selected_modifier_names?.length ? (
                            <p className="text-xs text-muted-foreground">+ {item.selected_modifier_names.join(', ')}</p>
                          ) : null}
                          {item.special_instructions && (
                            <p className="text-xs text-destructive font-medium mt-1">Note: {item.special_instructions}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-xs capitalize ${statusColors[item.status] || ''}`}>
                          {item.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Order actions */}
                <div className="p-3 border-t border-border flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-[130px]"
                    onClick={() => printTicket(ticket)}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Print Ticket
                  </Button>

                  {ticket.order.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[130px]"
                      onClick={() => updateOrderStatus(ticket.order.id, getAdvanceStatus(ticket.order.status))}
                    >
                      {getAdvanceLabel(ticket.order.status)}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    className="flex-1 min-w-[130px]"
                    onClick={() => updateOrderStatus(ticket.order.id, ticket.order.status === 'completed' ? 'pending' : 'completed')}
                  >
                    {ticket.order.status === 'completed' ? 'Reopen' : 'Complete'}
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Kitchen;
