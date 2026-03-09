import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Crown, Settings, ShoppingBag, DollarSign, TrendingUp, Clock } from "lucide-react";
import { CreateRestaurantModal } from "@/components/CreateRestaurantModal";
import { RestaurantCard } from "@/components/RestaurantCard";
import { PremiumBadge } from "@/components/PremiumBadge";
import { PaywallModal } from "@/components/PaywallModal";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { toast } from "@/hooks/use-toast";
import { isToday, parseISO } from 'date-fns';

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allRestaurants = [], isLoading } = useRestaurants();
  
  // Defensive filter: only show restaurants owned by current user
  const restaurants = allRestaurants.filter(r => r.owner_id === user?.id);
  const { hasPremium, subscription, refetch, isLoading: subscriptionLoading } = useSubscription();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [dailyStats, setDailyStats] = useState({ orders: 0, revenue: 0, active: 0 });

  // Fetch today's stats across all restaurants
  useEffect(() => {
    if (!user?.id || restaurants.length === 0) return;
    const restaurantIds = restaurants.map(r => r.id);
    supabase
      .from('orders')
      .select('id, status, total_cents, created_at')
      .in('restaurant_id', restaurantIds)
      .then(({ data }) => {
        if (!data) return;
        const todayOrders = data.filter(o => isToday(parseISO(o.created_at)));
        const active = data.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length;
        const revenue = todayOrders
          .filter(o => o.status === 'completed')
          .reduce((sum, o) => sum + o.total_cents, 0);
        setDailyStats({ orders: todayOrders.length, revenue, active });
      });
  }, [user?.id, restaurants.length]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Handle successful payment redirect — sync subscription from Stripe
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success) {
      // Sync subscription status from Stripe
      supabase.functions.invoke('fix-subscription').then(({ error }) => {
        if (error) {
          console.error('Subscription sync error:', error);
        }
        refetch();
        toast({
          title: "Welcome to Premium! 🎉",
          description: "Your subscription is now active. Enjoy all premium features!",
        });
      });
      setSearchParams({});
    } else if (canceled) {
      toast({
        title: "Checkout Canceled",
        description: "You can upgrade to premium anytime from your dashboard.",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetch]);

  return (
    <div className="min-h-screen bg-background" style={{ minHeight: '100vh' }}>
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Restaurants</h1>
            <div className="flex items-center gap-2 mt-1">
              {subscriptionLoading ? (
                <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <PremiumBadge isPremium={hasPremium} />
                  {!hasPremium && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-primary"
                      onClick={() => setShowPaywall(true)}
                    >
                      Upgrade to Premium
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAccountSettings(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Account
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        {restaurants.length > 0 && !isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShoppingBag className="h-4 w-4" /> Today's Orders
              </div>
              <p className="text-2xl font-bold text-foreground">{dailyStats.orders}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" /> Today's Revenue
              </div>
              <p className="text-2xl font-bold text-emerald-600">${(dailyStats.revenue / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="h-4 w-4" /> Active Orders
              </div>
              <p className="text-2xl font-bold text-foreground">{dailyStats.active}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" /> Restaurants
              </div>
              <p className="text-2xl font-bold text-foreground">{restaurants.length}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create card skeleton */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 min-h-[300px] animate-pulse">
              <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4" />
              <div className="h-4 w-32 bg-muted rounded mx-auto mb-2" />
              <div className="h-3 w-48 bg-muted rounded mx-auto" />
            </div>
            {/* Restaurant card skeletons */}
            {[1, 2].map((i) => (
              <div key={i} className="border border-border rounded-lg overflow-hidden">
                <div className="aspect-video bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                  <div className="h-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create New Restaurant Card */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-4 hover:border-primary transition-colors min-h-[300px]"
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-1">Create New Restaurant</h3>
                <p className="text-sm text-muted-foreground">
                  Start building your digital menu
                </p>
              </div>
            </button>

            {/* Restaurant Cards */}
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}

        {!isLoading && restaurants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              You haven't created any restaurants yet. Click the card above to get started!
            </p>
          </div>
        )}
      </main>

      <CreateRestaurantModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      <PaywallModal
        open={showPaywall}
        onOpenChange={setShowPaywall}
        feature="Premium Features"
      />

      <AccountSettingsDialog
        open={showAccountSettings}
        onOpenChange={setShowAccountSettings}
      />
    </div>
  );
};

export default Dashboard;
