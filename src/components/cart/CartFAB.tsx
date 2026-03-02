import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';

interface CartFABProps {
  onClick: () => void;
}

export const CartFAB = ({ onClick }: CartFABProps) => {
  const { totalItems, totalCents } = useCart();

  if (totalItems === 0) return null;

  const totalFormatted = `$${(totalCents / 100).toFixed(2)}`;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 md:left-auto md:right-6 md:w-auto">
      <Button
        onClick={onClick}
        className="w-full md:w-auto h-14 rounded-2xl shadow-lg px-6 gap-3 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          <span className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
            {totalItems}
          </span>
        </div>
        <span>View Cart</span>
        <span className="ml-auto">{totalFormatted}</span>
      </Button>
    </div>
  );
};
