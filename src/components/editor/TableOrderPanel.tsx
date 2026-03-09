import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Clock, User, DollarSign, UtensilsCrossed, Users, Pencil, Check, Trash2, QrCode, Download } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';
import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';

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

  const handleMarkPaid = async () => {
    if (!table.activeOrder) return;
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', table.activeOrder.id);
    onRefresh();
  };

  const handleClearTable = async () => {
    if (!table.activeOrder) return;
    await supabase.from('orders').update({ status: 'completed' }).eq('id', table.activeOrder.id);
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
    { value: 'available', label: 'Available' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'dirty', label: 'Needs Bussing' },
    { value: 'unavailable', label: 'Unavailable' },
  ];

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            {editingLabel ? (
              <div className="flex items-center gap-1">
                <Input value={labelValue} onChange={(e) => setLabelValue(e.target.value)} className="h-7 text-sm bg-secondary border-border" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveLabel}><Check className="h-3 w-3" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground tracking-tight">{table.label}</h3>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setLabelValue(table.label); setEditingLabel(true); }}>
                  <Pencil className="h-2.5 w-2.5" />
                </Button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground font-mono tracking-wide mt-0.5">QR: {table.qr_code_id}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="space-y-2">
          {/* Capacity */}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {editingCapacity ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number" min={1} max={20}
                  value={capacityValue}
                  onChange={(e) => setCapacityValue(parseInt(e.target.value) || 1)}
                  className="h-7 w-16 text-sm bg-secondary border-border"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveCapacity}><Check className="h-3 w-3" /></Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs"
                onClick={() => { setCapacityValue(table.capacity); setEditingCapacity(true); }}
              >
                <span>{table.capacity} seats</span>
                <Pencil className="h-2.5 w-2.5" />
              </button>
            )}
            <span className="ml-auto text-[10px] font-mono text-muted-foreground uppercase tracking-wider border border-border rounded px-1.5 py-0.5">
              {table.shape}
            </span>
          </div>

          {/* Server */}
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {editingServer ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={serverValue}
                  onChange={(e) => setServerValue(e.target.value)}
                  placeholder="Server name"
                  className="h-7 text-sm bg-secondary border-border"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveServer}><Check className="h-3 w-3" /></Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs"
                onClick={() => { setServerValue(table.server_name || ''); setEditingServer(true); }}
              >
                <span>{table.server_name || 'No server'}</span>
                <Pencil className="h-2.5 w-2.5" />
              </button>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            <Label className="text-muted-foreground text-[10px] uppercase tracking-wider shrink-0">Status</Label>
            <Select value={table.table_status} onValueChange={handleTableStatusChange}>
              <SelectTrigger className="h-7 text-xs flex-1 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tableStatusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* QR Code */}
        <div className="mb-4 p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <QrCode className="h-3 w-3" /> QR Code
            </h4>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => {
                const canvas = document.getElementById(`qr-table-${table.id}`) as HTMLCanvasElement;
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = `${table.label.replace(/\s+/g, '-')}-qr.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              }}
            >
              <Download className="h-2.5 w-2.5 mr-1" /> Download
            </Button>
          </div>
          <div className="flex justify-center bg-foreground rounded p-3">
            <QRCodeCanvas
              id={`qr-table-${table.id}`}
              value={`${window.location.origin}/menu?table=${table.qr_code_id}`}
              size={120}
              level="M"
              includeMargin
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
          <p className="text-[9px] text-muted-foreground text-center mt-1.5 font-mono">
            {table.qr_code_id}
          </p>
        </div>

        {table.activeOrder ? (
          <div className="space-y-3">
            {/* Order status */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize text-[10px] font-mono tracking-wide">
                {table.activeOrder.status}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-mono',
                  table.activeOrder.payment_status === 'paid'
                    ? 'border-foreground/30 text-foreground'
                    : 'border-destructive/30 text-destructive'
                )}
              >
                {table.activeOrder.payment_status === 'paid' ? '● Paid' : '○ Unpaid'}
              </Badge>
            </div>

            {/* Guest + Time */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{table.activeOrder.guest_name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono font-medium">{elapsed}</span>
              </div>
            </div>

            {/* Time bar */}
            {(() => {
              const mins = differenceInMinutes(new Date(), new Date(table.activeOrder.created_at));
              const pct = Math.min(100, (mins / 60) * 100);
              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>elapsed</span>
                    <span>{mins}min</span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground/60 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Total */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-bold text-lg text-foreground">{formatCents(table.activeOrder.total_cents)}</span>
              </div>
              {table.activeOrder.payment_status !== 'paid' && (
                <Button size="sm" className="h-7 text-xs" onClick={handleMarkPaid}>Mark Paid</Button>
              )}
            </div>

            {/* Clear Table */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-8"
              onClick={handleClearTable}
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Clear Table
            </Button>

            {/* Items */}
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <UtensilsCrossed className="h-3 w-3" />
                Items ({items.length})
              </h4>
              {loading ? (
                <div className="text-center py-4 text-xs text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div key={item.id} className="p-2.5 rounded border border-border">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-medium text-foreground">{item.quantity}× {item.dish_name}</span>
                          {item.selected_option_name && <p className="text-[10px] text-muted-foreground mt-0.5">{item.selected_option_name}</p>}
                          {item.selected_modifier_names && item.selected_modifier_names.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">+{item.selected_modifier_names.join(', ')}</p>
                          )}
                          {item.special_instructions && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">"{item.special_instructions}"</p>
                          )}
                        </div>
                        <span className="text-xs font-mono font-medium text-foreground">{formatCents(item.unit_price_cents * item.quantity)}</span>
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
              <UtensilsCrossed className="h-8 w-8 mx-auto text-muted-foreground/20 mb-3" />
              <h4 className="text-sm font-medium text-foreground mb-1">No Active Order</h4>
              <p className="text-xs text-muted-foreground">Table is empty</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
