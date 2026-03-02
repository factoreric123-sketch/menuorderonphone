import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock, ChefHat, Bell, PartyPopper } from 'lucide-react';

const STEPS = [
  { key: 'pending', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: Bell },
  { key: 'completed', label: 'Completed', icon: PartyPopper },
];

const OrderStatus = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('token');
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (!error && data) {
        // Only show if session_token matches (basic security for anonymous)
        if (data.session_token === sessionToken || sessionToken === null) {
          setOrder(data);
        }
      }

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at');

      if (itemsData) setItems(itemsData);
      setLoading(false);
    };

    fetchOrder();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        setOrder((prev: any) => ({ ...prev, ...payload.new }));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, (payload) => {
        setItems((prev) => prev.map((i) => (i.id === payload.new.id ? { ...i, ...payload.new } : i)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, sessionToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Order Not Found</h1>
          <p className="text-muted-foreground">This order doesn't exist or you don't have access.</p>
        </div>
      </div>
    );
  }

  const currentStepIdx = STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pt-8">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            {order.status === 'completed' ? (
              <PartyPopper className="h-8 w-8 text-primary" />
            ) : (
              <ChefHat className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {order.status === 'completed' ? 'Order Complete!' : 'Your Order'}
          </h1>
          <p className="text-muted-foreground text-sm">
            Order for <span className="font-medium text-foreground">{order.guest_name}</span>
          </p>
        </div>

        {/* Status Steps */}
        <div className="space-y-0">
          {STEPS.map((step, idx) => {
            const isActive = idx <= currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`w-0.5 h-8 ${isActive ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
                <div className="pt-2">
                  <p className={`font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Items */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Items</h2>
          <div className="rounded-xl border border-border divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="p-3 flex justify-between items-start">
                <div>
                  <span className="font-medium text-foreground">{item.quantity}× {item.dish_name}</span>
                  {item.selected_option_name && <p className="text-xs text-muted-foreground">{item.selected_option_name}</p>}
                  {item.selected_modifier_names?.length > 0 && (
                    <p className="text-xs text-muted-foreground">+ {item.selected_modifier_names.join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.status === 'ready' ? 'bg-primary/10 text-primary' :
                    item.status === 'preparing' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center p-4 rounded-xl bg-muted/30">
          <span className="font-medium text-foreground">Total</span>
          <span className="text-xl font-bold text-foreground">${(order.total_cents / 100).toFixed(2)}</span>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          This page updates automatically — no need to refresh.
        </p>
      </div>
    </div>
  );
};

export default OrderStatus;
