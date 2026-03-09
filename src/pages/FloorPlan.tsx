import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Save, Grid3X3, Pencil, ChefHat, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInMinutes } from 'date-fns';
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

export default function FloorPlan() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableWithOrder[]>([]);
  const [restaurant, setRestaurant] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableWithOrder | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;

    const { data: rest } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();
    setRestaurant(rest);

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

    const tableIds = tablesData.map(t => t.id);
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, table_id, guest_name, total_cents, payment_status, status, created_at')
      .in('table_id', tableIds)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: false });

    const orderIds = ordersData?.map(o => o.id) || [];
    const { data: itemsData } = orderIds.length > 0
      ? await supabase.from('order_items').select('order_id').in('order_id', orderIds)
      : { data: [] };

    const itemCounts = new Map<string, number>();
    itemsData?.forEach(item => {
      itemCounts.set(item.order_id, (itemCounts.get(item.order_id) || 0) + 1);
    });

    const tablesWithOrders: TableWithOrder[] = tablesData.map(table => {
      const activeOrder = ordersData?.find(o => o.table_id === table.id);
      return {
        ...table,
        position_x: table.position_x ?? 100,
        position_y: table.position_y ?? 100,
        width: table.width ?? 80,
        height: table.height ?? 80,
        shape: table.shape ?? 'square',
        capacity: table.capacity ?? 4,
        server_name: (table as any).server_name ?? null,
        table_status: (table as any).table_status ?? 'available',
        activeOrder: activeOrder ? {
          ...activeOrder,
          items_count: itemCounts.get(activeOrder.id) || 0,
        } : null,
      };
    });

    setTables(tablesWithOrders);
    if (selectedTable) {
      const updated = tablesWithOrders.find(t => t.id === selectedTable.id);
      if (updated) setSelectedTable(updated);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel('floor-plan-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, fetchData]);

  // Summary stats
  const stats = useMemo(() => {
    const occupied = tables.filter(t => !!t.activeOrder).length;
    const totalRevenue = tables.reduce((sum, t) => sum + (t.activeOrder?.total_cents || 0), 0);
    const waitTimes = tables
      .filter(t => !!t.activeOrder)
      .map(t => differenceInMinutes(new Date(), new Date(t.activeOrder!.created_at)));
    const avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;
    const reserved = tables.filter(t => t.table_status === 'reserved').length;
    const dirty = tables.filter(t => t.table_status === 'dirty').length;
    return { occupied, total: tables.length, totalRevenue, avgWait, reserved, dirty };
  }, [tables]);

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleTableMove = (tableId: string, x: number, y: number) => {
    setTables(prev => prev.map(t => (t.id === tableId ? { ...t, position_x: x, position_y: y } : t)));
    setHasUnsavedChanges(true);
  };

  const handleTableResize = (tableId: string, width: number, height: number) => {
    setTables(prev => prev.map(t => (t.id === tableId ? { ...t, width, height } : t)));
    setHasUnsavedChanges(true);
  };

  const handleTableShapeToggle = (tableId: string) => {
    setTables(prev => prev.map(t => (t.id === tableId ? { ...t, shape: t.shape === 'round' ? 'square' : 'round' } : t)));
    setHasUnsavedChanges(true);
  };

  const handleTableDelete = async (tableId: string) => {
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', tableId);
    if (error) { toast.error('Failed to delete table'); return; }
    setTables(prev => prev.filter(t => t.id !== tableId));
    if (selectedTable?.id === tableId) setSelectedTable(null);
    toast.success('Table deleted');
  };

  const handleSaveLayout = async () => {
    const updates = tables.map(t => ({
      id: t.id,
      position_x: t.position_x,
      position_y: t.position_y,
      width: t.width,
      height: t.height,
      shape: t.shape,
    }));

    for (const update of updates) {
      await supabase
        .from('restaurant_tables')
        .update({
          position_x: update.position_x,
          position_y: update.position_y,
          width: update.width,
          height: update.height,
          shape: update.shape,
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
      position_x: 100 + (tables.length % 5) * 120,
      position_y: 100 + Math.floor(tables.length / 5) * 120,
    });

    if (error) { toast.error('Failed to add table'); return; }
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{restaurant?.name || 'Restaurant'}</h1>
              <p className="text-sm text-muted-foreground">Floor Plan · {tables.length} tables</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Cross-navigation */}
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/${restaurantId}/tickets`)}>
              <ChefHat className="h-4 w-4 mr-1" /> Kitchen
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/${restaurantId}/orders`)}>
              <ClipboardList className="h-4 w-4 mr-1" /> Orders
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode(!editMode)}>
              {editMode ? <Grid3X3 className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
              {editMode ? 'View Mode' : 'Edit Layout'}
            </Button>

            {editMode && (
              <>
                <Button variant="outline" size="sm" onClick={handleAddTable}>
                  <Plus className="h-4 w-4 mr-1" /> Add Table
                </Button>
                <Button size="sm" onClick={handleSaveLayout} disabled={!hasUnsavedChanges}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </>
            )}

            {!editMode && stats.dirty > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                onClick={async () => {
                  const dirtyIds = tables.filter(t => t.table_status === 'dirty').map(t => t.id);
                  for (const id of dirtyIds) {
                    await supabase.from('restaurant_tables').update({ table_status: 'available' } as any).eq('id', id);
                  }
                  fetchData();
                  toast.success(`${dirtyIds.length} tables marked clean`);
                }}
              >
                ✨ Mark All Clean ({stats.dirty})
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-6 text-sm bg-muted/30 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Occupied:</span>
            <span className="font-semibold text-foreground">{stats.occupied}/{stats.total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-semibold text-emerald-600">{formatCents(stats.totalRevenue)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Avg Wait:</span>
            <span className="font-semibold text-foreground">{stats.avgWait}m</span>
          </div>
          {stats.reserved > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-muted-foreground">Reserved:</span>
              <span className="font-semibold text-foreground">{stats.reserved}</span>
            </div>
          )}
          {stats.dirty > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Needs Bussing:</span>
              <span className="font-semibold text-foreground">{stats.dirty}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="flex-1 relative overflow-hidden">
          <FloorPlanCanvas
            tables={tables}
            editMode={editMode}
            selectedTableId={selectedTable?.id}
            onTableMove={handleTableMove}
            onTableResize={handleTableResize}
            onTableShapeToggle={handleTableShapeToggle}
            onTableDelete={handleTableDelete}
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

        {selectedTable && (
          <TableOrderPanel
            table={selectedTable}
            onClose={() => setSelectedTable(null)}
            onRefresh={fetchData}
          />
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-border bg-card/50 px-4 py-2 flex items-center gap-4 text-sm flex-wrap">
        <span className="text-muted-foreground">Status:</span>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-muted" /><span>Empty</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500" /><span>Pending</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500" /><span>Preparing</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span>Ready</span></div>
        <div className="w-px h-4 bg-border mx-1" />
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-violet-500" /><span>Reserved</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500" /><span>Dirty</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-muted-foreground/40" /><span>Unavailable</span></div>
        {editMode && (
          <span className="ml-auto text-muted-foreground text-xs">Double-click table to toggle round/square · Drag corner to resize</span>
        )}
      </div>
    </div>
  );
}
