import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';

export interface CartItem {
  id: string; // unique cart line ID
  dishId: string;
  dishName: string;
  priceCents: number;
  quantity: number;
  selectedOptionId?: string;
  selectedOptionName?: string;
  selectedOptionPriceCents?: number;
  selectedModifierIds?: string[];
  selectedModifierNames?: string[];
  selectedModifierPricesCents?: number[];
  specialInstructions?: string;
  image?: string;
}

interface CartState {
  restaurantId: string;
  tableQrCodeId?: string;
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'UPDATE_QUANTITY'; id: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_RESTAURANT'; restaurantId: string; tableQrCodeId?: string }
  | { type: 'LOAD'; state: CartState };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Check for duplicate (same dish + same options + same modifiers)
      const existing = state.items.find(
        (i) =>
          i.dishId === action.item.dishId &&
          i.selectedOptionId === action.item.selectedOptionId &&
          JSON.stringify(i.selectedModifierIds?.sort()) === JSON.stringify(action.item.selectedModifierIds?.sort()) &&
          i.specialInstructions === action.item.specialInstructions
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === existing.id ? { ...i, quantity: i.quantity + action.item.quantity } : i
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case 'UPDATE_QUANTITY':
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.id !== action.id) };
      }
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, quantity: action.quantity } : i)),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'SET_RESTAURANT':
      if (state.restaurantId === action.restaurantId) {
        return { ...state, tableQrCodeId: action.tableQrCodeId };
      }
      return { restaurantId: action.restaurantId, tableQrCodeId: action.tableQrCodeId, items: [] };
    case 'LOAD':
      return action.state;
    default:
      return state;
  }
}

function getItemLineCents(item: CartItem): number {
  const base = item.selectedOptionPriceCents ?? item.priceCents;
  const modTotal = item.selectedModifierPricesCents?.reduce((s, p) => s + p, 0) ?? 0;
  return (base + modTotal) * item.quantity;
}

interface CartContextValue {
  items: CartItem[];
  restaurantId: string;
  tableQrCodeId?: string;
  totalItems: number;
  totalCents: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setRestaurant: (restaurantId: string, tableQrCodeId?: string) => void;
  getItemTotal: (item: CartItem) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = 'menutap_cart';

function loadCart(): CartState {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { restaurantId: '', items: [] };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadCart);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const totalItems = state.items.reduce((s, i) => s + i.quantity, 0);
  const totalCents = state.items.reduce((s, i) => s + getItemLineCents(i), 0);

  const addItem = useCallback((item: CartItem) => dispatch({ type: 'ADD_ITEM', item }), []);
  const removeItem = useCallback((id: string) => dispatch({ type: 'REMOVE_ITEM', id }), []);
  const updateQuantity = useCallback((id: string, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', id, quantity }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const setRestaurant = useCallback((restaurantId: string, tableQrCodeId?: string) => dispatch({ type: 'SET_RESTAURANT', restaurantId, tableQrCodeId }), []);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        restaurantId: state.restaurantId,
        tableQrCodeId: state.tableQrCodeId,
        totalItems,
        totalCents,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        setRestaurant,
        getItemTotal: getItemLineCents,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
