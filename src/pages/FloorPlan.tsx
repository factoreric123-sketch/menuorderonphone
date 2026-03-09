import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Save, Grid3X3, Pencil, ChefHat, ClipboardList, Sparkles } from 'lucide-react';
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
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                {restaurant?.name || 'Restaurant'}
              </h1>
              <p className="text-xs text-muted-foreground tracking-wide uppercase">
                Floor Plan · {tables.length} tables
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => navigate(`/dashboard/${restaurantId}/tickets`)}
            >
              <ChefHat className="h-3.5 w-3.5 mr-1.5" /> Kitchen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => navigate(`/dashboard/${restaurantId}/orders`)}
            >
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Orders
            </Button>

            <div className="w-px h-5 bg-border mx-1" />

            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Grid3X3 className="h-3.5 w-3.5 mr-1.5" /> : <Pencil className="h-3.5 w-3.5 mr-1.5" />}
              {editMode ? 'Done' : 'Edit'}
            </Button>

            {editMode && (
              <>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleAddTable}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
                <Button size="sm" className="text-xs h-8" onClick={handleSaveLayout} disabled={!hasUnsavedChanges}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
              </>
            )}

            {!editMode && stats.dirty > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={async () => {
                  const dirtyIds = tables.filter(t => t.table_status === 'dirty').map(t => t.id);
                  for (const id of dirtyIds) {
                    await supabase.from('restaurant_tables').update({ table_status: 'available' } as any).eq('id', id);
                  }
                  fetchData();
                  toast.success(`${dirtyIds.length} tables marked clean`);
                }}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Clean All ({stats.dirty})
              </Button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-5 py-2 border-t border-border flex items-center gap-8 text-xs tracking-wide">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase">Occupied</span>
            <span className="font-mono font-semibold text-foreground">{stats.occupied}/{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase">Revenue</span>
            <span className="font-mono font-semibold text-foreground">{formatCents(stats.totalRevenue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase">Avg Wait</span>
            <span className="font-mono font-semibold text-foreground">{stats.avgWait}m</span>
          </div>
          {stats.reserved > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground uppercase">Reserved</span>
              <span className="font-mono font-semibold text-foreground">{stats.reserved}</span>
            </div>
          )}
          {stats.dirty > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground uppercase">Dirty</span>
              <span className="font-mono font-semibold text-foreground">{stats.dirty}</span>
            </div>
          )}
        </div>
      </header>

      {/* Canvas + Panel */}
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
                <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                <h3 className="text-sm font-medium text-foreground mb-1">No tables yet</h3>
                <p className="text-xs text-muted-foreground mb-4">Add tables to build your floor plan</p>
                <Button size="sm" onClick={handleAddTable}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Table
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
      <div className="border-t border-border px-5 py-2 flex items-center gap-5 text-[11px] tracking-wide text-muted-foreground">
        <span className="uppercase font-medium">Legend</span>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-muted-foreground/30" /><span>Empty</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-foreground/40" /><span>Pending</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-foreground/60" /><span>Preparing</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-foreground" /><span>Ready</span></div>
        <div className="w-px h-3 bg-border mx-1" />
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-foreground/50" /><span>Reserved</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-foreground/20 border border-dashed border-foreground/30" /><span>Dirty</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-muted-foreground/10 border border-muted-foreground/20" /><span>Off</span></div>
        {editMode && (
          <span className="ml-auto text-muted-foreground/60 text-[10px]">Double-click → toggle shape · Drag corner → resize</span>
        )}
      </div>
    </div>
  );
}
