import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, ChefHat, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface OrderItem {
  id: string;
  order_id: string;
  dish_name: string;
  quantity: number;
  selected_option_name: string | null;
  selected_modifier_names: string[] | null;
  special_instructions: string | null;
  station: string;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  guest_name: string;
  table_id: string | null;
  status: string;
  created_at: string;
  notes: string | null;
}

interface TicketGroup {
  order: Order;
  items: OrderItem[];
  tableLabel?: string;
}

const STATIONS = ['all', 'kitchen', 'bar', 'dessert'];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  preparing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ready: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const Kitchen = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketGroup[]>([]);
  const [activeStation, setActiveStation] = useState('all');
  const [tables, setTables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;

    // Fetch tables for labels
    const { data: tablesData } = await supabase
      .from('restaurant_tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId);

    const tableMap: Record<string, string> = {};
    tablesData?.forEach((t: any) => { tableMap[t.id] = t.label; });
    setTables(tableMap);

    // Fetch active orders (not completed/cancelled)
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (!orders?.length) {
      setTickets([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map((o: any) => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at');

    const grouped: TicketGroup[] = orders.map((order: any) => ({
      order,
      items: (items || []).filter((i: any) => i.order_id === order.id),
      tableLabel: order.table_id ? tableMap[order.table_id] : undefined,
    }));

    setTickets(grouped);
    setLoading(false);
  }, [restaurantId]);

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
    await supabase.from('order_items').update({ status: next }).eq('id', itemId);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    toast.success(`Order marked as ${status}`);
  };

  const filteredTickets = tickets.map((t) => ({
    ...t,
    items: activeStation === 'all' ? t.items : t.items.filter((i) => i.station === activeStation),
  })).filter((t) => t.items.length > 0);

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ChefHat className="h-5 w-5" /> Kitchen Board
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
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
            <p className="text-muted-foreground">No active orders</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTickets.map(({ order, items, tableLabel }) => (
              <div key={order.id} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                {/* Ticket header */}
                <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <div>
                    <span className="font-semibold text-foreground">{order.guest_name}</span>
                    {tableLabel && <Badge variant="outline" className="ml-2 text-xs">{tableLabel}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {timeAgo(order.created_at)}
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-border">
                  {items.map((item) => (
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
                            <p className="text-xs text-destructive font-medium mt-1">⚠ {item.special_instructions}</p>
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
                <div className="p-3 border-t border-border flex gap-2">
                  {order.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => updateOrderStatus(order.id, order.status === 'pending' ? 'confirmed' : order.status === 'confirmed' ? 'preparing' : 'ready')}
                    >
                      {order.status === 'pending' ? 'Confirm' : order.status === 'confirmed' ? 'Start Prep' : 'Mark Ready'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                  >
                    Complete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Kitchen;
