import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Clock, User, DollarSign, UtensilsCrossed, Users, Pencil, Check } from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

interface TableWithOrder {
  id: string;
  label: string;
  qr_code_id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  shape: string;
  capacity: number;
  active: boolean;
  activeOrder?: {
    id: string;
    guest_name: string;
    total_cents: number;
    payment_status: string;
    status: string;
    created_at: string;
    items_count: number;
  } | null;
}

interface OrderItem {
  id: string;
  dish_name: string;
  quantity: number;
  unit_price_cents: number;
  selected_option_name: string | null;
  selected_modifier_names: string[] | null;
  special_instructions: string | null;
  status: string;
}

interface TableOrderPanelProps {
  table: TableWithOrder;
  onClose: () => void;
  onRefresh: () => void;
}

export function TableOrderPanel({ table, onClose, onRefresh }: TableOrderPanelProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityValue, setCapacityValue] = useState(table.capacity);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(table.label);
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (table.activeOrder) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [table.activeOrder?.id]);

  // Live elapsed time counter
  useEffect(() => {
    if (!table.activeOrder) { setElapsed(''); return; }
    const update = () => {
      const mins = differenceInMinutes(new Date(), new Date(table.activeOrder!.created_at));
      if (mins < 60) setElapsed(`${mins}m`);
      else setElapsed(`${Math.floor(mins / 60)}h ${mins % 60}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [table.activeOrder?.created_at]);

  const fetchItems = async () => {
    if (!table.activeOrder) return;
    setLoading(true);
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', table.activeOrder.id)
      .order('created_at');
    setItems(data || []);
    setLoading(false);
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      preparing: 'default',
      ready: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'} className="capitalize">{status}</Badge>;
  };

  const getPaymentBadge = (status: string) => {
    if (status === 'paid') return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Paid</Badge>;
    return <Badge variant="destructive" className="bg-destructive/20 text-destructive">Unpaid</Badge>;
  };

  const handleMarkPaid = async () => {
    if (!table.activeOrder) return;
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', table.activeOrder.id);
    onRefresh();
  };

  const handleSaveCapacity = async () => {
    await supabase.from('restaurant_tables').update({ capacity: capacityValue } as any).eq('id', table.id);
    setEditingCapacity(false);
    onRefresh();
  };

  const handleSaveLabel = async () => {
    await supabase.from('restaurant_tables').update({ label: labelValue }).eq('id', table.id);
    setEditingLabel(false);
    onRefresh();
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            {editingLabel ? (
              <div className="flex items-center gap-1">
                <Input value={labelValue} onChange={(e) => setLabelValue(e.target.value)} className="h-7 text-sm" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveLabel}><Check className="h-3 w-3" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h3 className="font-semibold text-foreground">{table.label}</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setLabelValue(table.label); setEditingLabel(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">QR: {table.qr_code_id}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          {editingCapacity ? (
            <div className="flex items-center gap-1">
              <Input
                type="number" min={1} max={20}
                value={capacityValue}
                onChange={(e) => setCapacityValue(parseInt(e.target.value) || 1)}
                className="h-7 w-16 text-sm"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveCapacity}><Check className="h-3 w-3" /></Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setCapacityValue(table.capacity); setEditingCapacity(true); }}
            >
              <span>{table.capacity} seats</span>
              <Pencil className="h-3 w-3" />
            </button>
          )}
          <Badge variant="outline" className="ml-auto capitalize text-xs">{table.shape}</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {table.activeOrder ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                {getStatusBadge(table.activeOrder.status)}
                {getPaymentBadge(table.activeOrder.payment_status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="truncate">{table.activeOrder.guest_name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{elapsed}</span>
                </div>
              </div>

              {/* Time elapsed bar */}
              {(() => {
                const mins = differenceInMinutes(new Date(), new Date(table.activeOrder.created_at));
                const pct = Math.min(100, (mins / 60) * 100);
                const color = mins > 45 ? 'bg-destructive' : mins > 20 ? 'bg-amber-500' : 'bg-emerald-500';
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Time elapsed</span>
                      <span>{mins}min</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg text-foreground">{formatCents(table.activeOrder.total_cents)}</span>
                </div>
                {table.activeOrder.payment_status !== 'paid' && (
                  <Button size="sm" onClick={handleMarkPaid}>Mark Paid</Button>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                Order Items ({items.length})
              </h4>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-foreground">{item.quantity}× {item.dish_name}</span>
                          {item.selected_option_name && <p className="text-xs text-muted-foreground mt-0.5">{item.selected_option_name}</p>}
                          {item.selected_modifier_names && item.selected_modifier_names.length > 0 && (
                            <p className="text-xs text-muted-foreground">+{item.selected_modifier_names.join(', ')}</p>
                          )}
                          {item.special_instructions && (
                            <p className="text-xs text-amber-600 mt-1 italic">"{item.special_instructions}"</p>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">{formatCents(item.unit_price_cents * item.quantity)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <h4 className="font-medium text-foreground mb-1">No Active Order</h4>
              <p className="text-sm text-muted-foreground">This table doesn't have any active orders</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
