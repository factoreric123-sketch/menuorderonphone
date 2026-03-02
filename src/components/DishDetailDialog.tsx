import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Badge } from "@/components/ui/badge";
import { X, Flame, Wheat, Milk, Egg, Fish, Shell, Nut, Sprout, Beef, Bird, Salad, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useDishOptions } from "@/hooks/useDishOptions";
import { useDishModifiers } from "@/hooks/useDishModifiers";
import { getFontClassName } from "@/lib/fontUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCart } from "@/contexts/CartContext";
import { generateUUID } from "@/lib/utils/uuid";
import { toast } from "sonner";

export interface DishDetail {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  allergens?: string[];
  calories?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isSpicy?: boolean;
  hasOptions?: boolean;
  options?: Array<{ id: string; name: string; price: string; order_index: number }>;
  modifiers?: Array<{ id: string; name: string; price: string; order_index: number }>;
}

interface DishDetailDialogProps {
  dish: DishDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forceTwoDecimals?: boolean;
  showCurrencySymbol?: boolean;
  menuFont?: string;
  cardImageShape?: 'square' | 'vertical';
  useStaticOptions?: boolean;
  orderingEnabled?: boolean;
}

const allergenIconMap: Record<string, any> = {
  gluten: Wheat,
  dairy: Milk,
  eggs: Egg,
  fish: Fish,
  shellfish: Shell,
  nuts: Nut,
  soy: Sprout,
  pork: Beef,
  beef: Beef,
  poultry: Bird,
};

export const DishDetailDialog = ({ 
  dish, 
  open, 
  onOpenChange, 
  forceTwoDecimals = false, 
  showCurrencySymbol = true, 
  menuFont = 'Inter',
  cardImageShape = 'square',
  useStaticOptions = false,
  orderingEnabled = false
}: DishDetailDialogProps) => {
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollY = useRef<number>(0);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  
  // All hooks must be called BEFORE any conditional returns (Rules of Hooks)
  const [selectedOption, setSelectedOption] = useState("");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  
  // For demo page: use static options from dish data
  // For live menu: fetch from database
  const { data: fetchedOptions } = useDishOptions(
    useStaticOptions || !dish ? '' : dish.id
  );
  const { data: fetchedModifiers } = useDishModifiers(
    useStaticOptions || !dish ? '' : dish.id
  );
  
  // Use static options from dish prop if useStaticOptions is true, otherwise use fetched data
  const options = dish ? (useStaticOptions ? (dish.options || []) : (fetchedOptions || [])) : [];
  const modifiers = dish ? (useStaticOptions ? (dish.modifiers || []) : (fetchedModifiers || [])) : [];
  
  // Show options section based on actual data
  const hasAnyOptions = options.length > 0 || modifiers.length > 0;
  const showOptionsSection = hasAnyOptions;

  // Sync selectedOption when options change
  useEffect(() => {
    if (options.length > 0) {
      const firstOptionId = options[0].id;
      setSelectedOption(prev => options.some(o => o.id === prev) ? prev : firstOptionId);
    }
  }, [options]);

  // Reset quantity when dialog opens
  useEffect(() => {
    if (open) setQuantity(1);
  }, [open]);

  const handleAddToCart = useCallback(() => {
    if (!dish) return;

    const selectedOpt = options.find(o => o.id === selectedOption);
    const selectedMods = modifiers.filter(m => selectedModifiers.includes(m.id));

    const priceCents = Math.round(parseFloat(dish.price.replace(/[^0-9.]/g, "")) * 100);

    addItem({
      id: generateUUID(),
      dishId: dish.id,
      dishName: dish.name,
      priceCents,
      quantity,
      selectedOptionId: selectedOpt?.id,
      selectedOptionName: selectedOpt?.name,
      selectedOptionPriceCents: selectedOpt ? Math.round(parseFloat(selectedOpt.price.replace(/[^0-9.]/g, "")) * 100) : undefined,
      selectedModifierIds: selectedMods.map(m => m.id),
      selectedModifierNames: selectedMods.map(m => m.name),
      selectedModifierPricesCents: selectedMods.map(m => Math.round(parseFloat(m.price.replace(/[^0-9.]/g, "")) * 100)),
      image: dish.image,
    });

    toast.success(`${dish.name} added to cart`);
    onOpenChange(false);
  }, [dish, options, selectedOption, modifiers, selectedModifiers, quantity, addItem, onOpenChange]);

  // Mobile scroll lock - prevents background scroll while modal is open
  useEffect(() => {
    if (!open || !isMobile) return;
    
    // Capture scroll position at open time
    const scrollY = window.scrollY;
    savedScrollY.current = scrollY;
    
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    
    // Reset scroll container to top
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    
    return () => {
      // Get saved position before clearing styles
      const savedY = savedScrollY.current;
      
      // Clear all body styles first
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      
      // Restore scroll position instantly (no animation)
      window.scrollTo({ top: savedY, behavior: 'instant' });
    };
  }, [open, isMobile]);
  
  // Early return AFTER all hooks
  if (!dish) return null;
  
  const fontClass = getFontClassName(menuFont);
  const isVertical = cardImageShape === 'vertical';

  const formatPrice = (num: number, prefix: string = "") => {
    const currencySymbol = showCurrencySymbol ? "$" : "";
    if (forceTwoDecimals) {
      return `${prefix}${currencySymbol}${num.toFixed(2)}`;
    }
    return Number.isInteger(num) ? `${prefix}${currencySymbol}${num}` : `${prefix}${currencySymbol}${num.toFixed(2)}`;
  };

  const calculateTotalPrice = () => {
    let total = 0;
    
    // Base price or selected option price
    if (showOptionsSection && options.length > 0) {
      const option = options.find(o => o.id === selectedOption);
      if (option) {
        const price = parseFloat(option.price.replace(/[^0-9.]/g, ""));
        if (!isNaN(price)) total += price;
      }
    } else {
      const price = parseFloat(dish.price.replace(/[^0-9.]/g, ""));
      if (!isNaN(price)) total += price;
    }
    
    // Add modifiers
    selectedModifiers.forEach(modId => {
      const modifier = modifiers.find(m => m.id === modId);
      if (modifier) {
        const price = parseFloat(modifier.price.replace(/[^0-9.]/g, ""));
        if (!isNaN(price)) total += price;
      }
    });
    
    return formatPrice(total);
  };

  const handleModifierToggle = (modifierId: string) => {
    setSelectedModifiers(prev =>
      prev.includes(modifierId)
        ? prev.filter(id => id !== modifierId)
        : [...prev, modifierId]
    );
  };

  // Shared content for both mobile drawer and desktop dialog
  const renderContent = () => (
    <>
      {/* Allergen badges */}
      {dish.allergens && dish.allergens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dish.allergens.map((allergen) => {
            const Icon = allergenIconMap[allergen.toLowerCase()] || Sprout;
            return (
              <Badge
                key={allergen}
                variant="secondary"
                className="px-2 py-0.5 text-xs flex items-center gap-1"
              >
                <Icon className="h-3 w-3" />
                {allergen.charAt(0).toUpperCase() + allergen.slice(1)}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Dietary badges */}
      <div className="flex flex-wrap gap-1.5">
        {dish.isVegan && (
          <Badge variant="outline" className="px-2 py-0.5 text-xs bg-ios-green/10 text-ios-green border-ios-green/20 flex items-center gap-1">
            <Sprout className="h-3 w-3" />
            Vegan
          </Badge>
        )}
        {dish.isVegetarian && !dish.isVegan && (
          <Badge variant="outline" className="px-2 py-0.5 text-xs bg-ios-green/10 text-ios-green border-ios-green/20 flex items-center gap-1">
            <Salad className="h-3 w-3" />
            Vegetarian
          </Badge>
        )}
        {dish.isSpicy && (
          <Badge variant="outline" className="px-2 py-0.5 text-xs bg-ios-red/10 text-ios-red border-ios-red/20 flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Spicy
          </Badge>
        )}
      </div>

      {/* Dish info */}
      <div className="text-left">
        <h2 className="text-3xl font-semibold text-foreground mb-2 text-left">{dish.name}</h2>
        <p className="text-muted-foreground leading-relaxed text-left">{dish.description}</p>
      </div>

      {/* Price and Options */}
      <div className="pt-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-semibold text-foreground">{calculateTotalPrice()}</div>
          {dish.calories && (
            <div className="text-sm text-muted-foreground">
              {dish.calories} calories
            </div>
          )}
        </div>

        {showOptionsSection && (
          <div className="space-y-4 pt-2">
            {options.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Size</Label>
                <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="space-y-2">
                  {options.map((option) => {
                    const priceNum = parseFloat(option.price.replace(/[^0-9.]/g, ""));
                    const formattedPrice = isNaN(priceNum) ? option.price : formatPrice(priceNum);
                    return (
                      <Label 
                        key={option.id} 
                        htmlFor={option.id}
                        className="flex items-center justify-between p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value={option.id} id={option.id} className="border-2" />
                          <span className="font-medium text-foreground">
                            {option.name}
                          </span>
                        </div>
                        <span className="text-base font-semibold text-foreground">{formattedPrice}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>
            )}

            {modifiers.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Extras</Label>
                <div className="space-y-2">
                  {modifiers.map((modifier) => {
                    const priceNum = parseFloat(modifier.price.replace(/[^0-9.]/g, ""));
                    const formattedPrice = isNaN(priceNum) ? modifier.price : formatPrice(priceNum, "+");
                    return (
                      <Label 
                        key={modifier.id} 
                        htmlFor={modifier.id}
                        className="flex items-center justify-between p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={modifier.id}
                            checked={selectedModifiers.includes(modifier.id)}
                            onCheckedChange={() => handleModifierToggle(modifier.id)}
                            className="border-2"
                          />
                          <span className="font-medium text-foreground">
                            {modifier.name}
                          </span>
                        </div>
                        <span className="text-base font-semibold text-muted-foreground">{formattedPrice}</span>
                      </Label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add to Cart Button */}
      {orderingEnabled && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleAddToCart} className="w-full h-12 rounded-xl text-base font-semibold gap-2">
            <ShoppingCart className="h-5 w-5" />
            Add to Cart — {calculateTotalPrice()}
          </Button>
        </div>
      )}
    </>
  );

  // Mobile/Tablet: Custom fullscreen modal using Portal
  if (isMobile) {
    if (!open) return null;
    
    const modalContent = (
      <div 
        className={`fixed inset-0 z-[100] ${fontClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-title"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80" />
        
        {/* Modal container with margins */}
        <div 
          className="absolute z-[101] bg-background"
          style={{
            top: '3vh',
            left: '3vw',
            right: '3vw',
            bottom: '3vh',
            borderRadius: '1.5rem',
            overflow: 'hidden',
          }}
        >
          {/* Accessibility */}
          <VisuallyHidden>
            <h2 id="dish-title">{dish.name}</h2>
            <p>{dish.description}</p>
          </VisuallyHidden>
          
          {/* X button - absolutely positioned within the modal */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-[102] h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm transition-all duration-150 active:scale-95 shadow-lg"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-6 w-6 text-white" />
          </Button>
          
          {/* Scrollable container */}
          <div 
            ref={scrollContainerRef}
            className="h-full w-full overflow-y-auto overscroll-none"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'none',
            }}
          >
            {/* Image section */}
            <img
              src={dish.image}
              alt={dish.name}
              className="w-full h-[55vh] object-cover block"
              style={{ borderRadius: '1.5rem 1.5rem 0 0' }}
            />
            
            {/* Content section */}
            <div className="p-6 pb-24 space-y-4 bg-background">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    );

    // Use Portal to render outside React tree, directly under document.body
    return createPortal(modalContent, document.body);
  }

  // Desktop: Use Dialog with side-by-side layout
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        hideClose
        className={`rounded-xl p-0 gap-0 bg-background overflow-hidden ${fontClass} ${
          isVertical 
            ? 'max-w-sm sm:max-w-md md:max-w-3xl md:flex md:flex-row md:h-[75vh]' 
            : 'max-w-[95vw] sm:max-w-lg md:max-w-4xl md:flex md:flex-row md:h-[70vh]'
        }`}
      >
        {/* Accessibility: Hidden title and description for screen readers */}
        <VisuallyHidden>
          <DialogTitle>{dish.name}</DialogTitle>
          <DialogDescription>{dish.description}</DialogDescription>
        </VisuallyHidden>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10 rounded-full bg-background/80 backdrop-blur-sm transition-all duration-150 active:scale-95"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Image Section */}
        <div className="relative bg-dish-card w-full md:w-1/2 md:flex-shrink-0 md:h-full">
          <img
            src={dish.image}
            alt={dish.name}
            className={`w-full object-cover ${
              isVertical 
                ? 'h-[65vh] sm:h-[55vh] md:h-full' 
                : 'h-[50vh] sm:h-[45vh] md:h-full'
            }`}
          />
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-4 md:w-1/2 md:overflow-y-auto">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
