import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, CreditCard, Banknote, Loader2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Checkout = () => {
  const navigate = useNavigate();
  const { items, totalCents, restaurantId, tableQrCodeId, clearCart, getItemTotal } = useCart();
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_table' | 'stripe'>('pay_at_table');
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Cart is Empty</h1>
          <p className="text-muted-foreground">Add items to your cart first.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setSubmitting(true);

    try {
      const orderItems = items.map((item) => ({
        dish_id: item.dishId,
        dish_name: item.dishName,
        quantity: item.quantity,
        unit_price_cents: item.selectedOptionPriceCents ?? item.priceCents,
        selected_option_name: item.selectedOptionName || null,
        selected_modifier_names: item.selectedModifierNames || [],
        subtotal_cents: getItemTotal(item),
        special_instructions: item.specialInstructions || null,
      }));

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          restaurant_id: restaurantId,
          table_qr_code_id: tableQrCodeId || null,
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim() || null,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
          items: orderItems,
        },
      });

      if (error) throw error;

      if (data?.order_id && data?.session_token) {
        clearCart();
        navigate(`/order-status/${data.order_id}?token=${data.session_token}`);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Order error:', err);
      toast.error(err.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Checkout</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Order Summary */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Order Summary</h2>
          <div className="rounded-xl border border-border divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="p-3 flex justify-between">
                <div>
                  <span className="font-medium text-foreground">{item.quantity}× {item.dishName}</span>
                  {item.selectedOptionName && <p className="text-xs text-muted-foreground">{item.selectedOptionName}</p>}
                  {item.selectedModifierNames?.length ? (
                    <p className="text-xs text-muted-foreground">+ {item.selectedModifierNames.join(', ')}</p>
                  ) : null}
                </div>
                <span className="font-semibold text-foreground">${(getItemTotal(item) / 100).toFixed(2)}</span>
              </div>
            ))}
            <div className="p-3 flex justify-between">
              <span className="font-bold text-foreground">Total</span>
              <span className="font-bold text-foreground text-lg">${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Details</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="For order updates" />
            </div>
            <div>
              <Label htmlFor="notes">Special Instructions</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, preferences..." rows={2} />
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payment</h2>
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} className="space-y-2">
            <Label htmlFor="pay_at_table" className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 cursor-pointer">
              <RadioGroupItem value="pay_at_table" id="pay_at_table" />
              <Banknote className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Pay at Table</p>
                <p className="text-xs text-muted-foreground">Pay your server when you're done</p>
              </div>
            </Label>
            <Label htmlFor="stripe" className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 cursor-pointer opacity-50 pointer-events-none">
              <RadioGroupItem value="stripe" id="stripe" disabled />
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Pay Online</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </Label>
          </RadioGroup>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !guestName.trim()}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          {submitting ? (
            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Placing Order...</>
          ) : (
            `Place Order — $${(totalCents / 100).toFixed(2)}`
          )}
        </Button>

        <div className="h-8" />
      </div>
    </div>
  );
};

export default Checkout;
