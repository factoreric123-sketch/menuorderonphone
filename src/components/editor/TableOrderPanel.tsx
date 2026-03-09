import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Clock, User, DollarSign, UtensilsCrossed, Users, Pencil, Check, Trash2, CalendarClock, SprayCan, Ban, CheckCircle2 } from 'lucide-react';
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
  server_name: string | null;
  table_status: string;
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
  const [editingServer, setEditingServer] = useState(false);
  const [serverValue, setServerValue] = useState(table.server_name || '');
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (table.activeOrder) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [table.activeOrder?.id]);

  useEffect(() => {
    setLabelValue(table.label);
    setCapacityValue(table.capacity);
    setServerValue(table.server_name || '');
  }, [table.id, table.label, table.capacity, table.server_name]);

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

  const handleClearTable = async () => {
    if (!table.activeOrder) return;
    await supabase.from('orders').update({ status: 'completed' }).eq('id', table.activeOrder.id);
    // Also set table status to dirty (needs bussing)
    await supabase.from('restaurant_tables').update({ table_status: 'dirty' } as any).eq('id', table.id);
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

  const handleSaveServer = async () => {
    await supabase.from('restaurant_tables').update({ server_name: serverValue || null } as any).eq('id', table.id);
    setEditingServer(false);
    onRefresh();
  };

  const handleTableStatusChange = async (status: string) => {
    await supabase.from('restaurant_tables').update({ table_status: status } as any).eq('id', table.id);
    onRefresh();
  };

  const tableStatusOptions = [
    { value: 'available', label: 'Available', icon: CheckCircle2, color: 'text-emerald-500' },
    { value: 'reserved', label: 'Reserved', icon: CalendarClock, color: 'text-violet-500' },
    { value: 'dirty', label: 'Needs Bussing', icon: SprayCan, color: 'text-orange-500' },
    { value: 'unavailable', label: 'Unavailable', icon: Ban, color: 'text-muted-foreground' },
  ];

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
        <div className="flex items-center gap-2 text-sm mb-2">
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

        {/* Server Assignment */}
        <div className="flex items-center gap-2 text-sm mb-2">
          <User className="h-4 w-4 text-muted-foreground" />
          {editingServer ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={serverValue}
                onChange={(e) => setServerValue(e.target.value)}
                placeholder="Server name"
                className="h-7 text-sm"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveServer}><Check className="h-3 w-3" /></Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setServerValue(table.server_name || ''); setEditingServer(true); }}
            >
              <span>{table.server_name || 'No server'}</span>
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Table Status */}
        <div className="flex items-center gap-2 text-sm">
          <Label className="text-muted-foreground text-xs shrink-0">Status:</Label>
          <Select value={table.table_status} onValueChange={handleTableStatusChange}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tableStatusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-1.5">
                    <opt.icon className={cn('h-3.5 w-3.5', opt.color)} />
                    <span>{opt.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

              {/* Clear Table Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                onClick={handleClearTable}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear Table
              </Button>
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
