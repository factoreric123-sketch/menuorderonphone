import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Clock, User, DollarSign, UtensilsCrossed } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TableWithOrder {
  id: string;
  label: string;
  qr_code_id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  shape: string;
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

  useEffect(() => {
    if (table.activeOrder) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [table.activeOrder?.id]);

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
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getPaymentBadge = (status: string) => {
    if (status === 'paid') {
      return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Paid</Badge>;
    }
    return <Badge variant="destructive" className="bg-destructive/20 text-destructive">Unpaid</Badge>;
  };

  const handleMarkPaid = async () => {
    if (!table.activeOrder) return;

    await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', table.activeOrder.id);

    onRefresh();
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{table.label}</h3>
          <p className="text-sm text-muted-foreground">QR: {table.qr_code_id}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {table.activeOrder ? (
          <div className="space-y-4">
            {/* Order header */}
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
                  <span>{formatDistanceToNow(new Date(table.activeOrder.created_at), { addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg text-foreground">
                    {formatCents(table.activeOrder.total_cents)}
                  </span>
                </div>
                {table.activeOrder.payment_status !== 'paid' && (
                  <Button size="sm" onClick={handleMarkPaid}>
                    Mark Paid
                  </Button>
                )}
              </div>
            </div>

            {/* Items */}
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
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-foreground">
                            {item.quantity}× {item.dish_name}
                          </span>
                          {item.selected_option_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.selected_option_name}
                            </p>
                          )}
                          {item.selected_modifier_names?.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              +{item.selected_modifier_names.join(', ')}
                            </p>
                          )}
                          {item.special_instructions && (
                            <p className="text-xs text-amber-600 mt-1 italic">
                              "{item.special_instructions}"
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {formatCents(item.unit_price_cents * item.quantity)}
                        </span>
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
              <p className="text-sm text-muted-foreground">
                This table doesn't have any active orders
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
