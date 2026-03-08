import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Save, Grid3X3, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { FloorPlanCanvas } from '@/components/editor/FloorPlanCanvas';
import { TableOrderPanel } from '@/components/editor/TableOrderPanel';

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

export default function FloorPlan() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [tables, setTables] = useState<TableWithOrder[]>([]);
  const [restaurant, setRestaurant] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableWithOrder | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;

    // Fetch restaurant info
    const { data: rest } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();
    setRestaurant(rest);

    // Fetch tables with their active orders
    const { data: tablesData } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at');

    if (!tablesData) {
      setTables([]);
      setLoading(false);
      return;
    }

    // Fetch active orders for each table
    const tableIds = tablesData.map(t => t.id);
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, table_id, guest_name, total_cents, payment_status, status, created_at')
      .in('table_id', tableIds)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: false });

    // Get item counts for active orders
    const orderIds = ordersData?.map(o => o.id) || [];
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('order_id')
      .in('order_id', orderIds);

    const itemCounts = new Map<string, number>();
    itemsData?.forEach(item => {
      itemCounts.set(item.order_id, (itemCounts.get(item.order_id) || 0) + 1);
    });

    // Map tables with their active order
    const tablesWithOrders: TableWithOrder[] = tablesData.map(table => {
      const activeOrder = ordersData?.find(o => o.table_id === table.id);
      return {
        ...table,
        position_x: table.position_x ?? 100,
        position_y: table.position_y ?? 100,
        width: table.width ?? 80,
        height: table.height ?? 80,
        shape: table.shape ?? 'square',
        activeOrder: activeOrder ? {
          ...activeOrder,
          items_count: itemCounts.get(activeOrder.id) || 0,
        } : null,
      };
    });

    setTables(tablesWithOrders);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscription for orders
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('floor-plan-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchData]);

  const handleTableMove = (tableId: string, x: number, y: number) => {
    setTables(prev =>
      prev.map(t => (t.id === tableId ? { ...t, position_x: x, position_y: y } : t))
    );
    setHasUnsavedChanges(true);
  };

  const handleSaveLayout = async () => {
    const updates = tables.map(t => ({
      id: t.id,
      position_x: t.position_x,
      position_y: t.position_y,
      width: t.width,
      height: t.height,
    }));

    for (const update of updates) {
      await supabase
        .from('restaurant_tables')
        .update({
          position_x: update.position_x,
          position_y: update.position_y,
          width: update.width,
          height: update.height,
        })
        .eq('id', update.id);
    }

    setHasUnsavedChanges(false);
    toast.success('Floor plan saved');
  };

  const handleAddTable = async () => {
    if (!restaurantId) return;

    const label = `Table ${tables.length + 1}`;
    const qrCodeId = crypto.randomUUID().slice(0, 8);

    const { error } = await supabase.from('restaurant_tables').insert({
      restaurant_id: restaurantId,
      label,
      qr_code_id: qrCodeId,
      position_x: 100 + (tables.length % 5) * 100,
      position_y: 100 + Math.floor(tables.length / 5) * 100,
    });

    if (error) {
      toast.error('Failed to add table');
      return;
    }

    fetchData();
    toast.success('Table added');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{restaurant?.name || 'Restaurant'}</h1>
              <p className="text-sm text-muted-foreground">Floor Plan</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Grid3X3 className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
              {editMode ? 'View Mode' : 'Edit Layout'}
            </Button>

            {editMode && (
              <>
                <Button variant="outline" size="sm" onClick={handleAddTable}>
                  <Plus className="h-4 w-4 mr-1" /> Add Table
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveLayout}
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <FloorPlanCanvas
            tables={tables}
            editMode={editMode}
            selectedTableId={selectedTable?.id}
            onTableMove={handleTableMove}
            onTableSelect={(table) => setSelectedTable(table)}
          />

          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <Grid3X3 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No tables yet</h3>
                <p className="text-muted-foreground mb-4">Add tables to build your floor plan</p>
                <Button onClick={handleAddTable}>
                  <Plus className="h-4 w-4 mr-2" /> Add First Table
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Order panel */}
        {selectedTable && (
          <TableOrderPanel
            table={selectedTable}
            onClose={() => setSelectedTable(null)}
            onRefresh={fetchData}
          />
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-border bg-card/50 px-4 py-2 flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Status:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>Empty</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Preparing</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Ready</span>
        </div>
      </div>
    </div>
  );
}
