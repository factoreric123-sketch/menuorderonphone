import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Users, Trash2, Ban, CalendarClock, SprayCan } from 'lucide-react';

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

interface FloorPlanCanvasProps {
  tables: TableWithOrder[];
  editMode: boolean;
  selectedTableId?: string;
  onTableMove: (tableId: string, x: number, y: number) => void;
  onTableResize: (tableId: string, width: number, height: number) => void;
  onTableShapeToggle: (tableId: string) => void;
  onTableDelete: (tableId: string) => void;
  onTableSelect: (table: TableWithOrder) => void;
}

export function FloorPlanCanvas({
  tables,
  editMode,
  selectedTableId,
  onTableMove,
  onTableResize,
  onTableShapeToggle,
  onTableDelete,
  onTableSelect,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ tableId: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ tableId: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, table: TableWithOrder) => {
      if (!editMode) {
        onTableSelect(table);
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragging({
        tableId: table.id,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      });
    },
    [editMode, onTableSelect]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, table: TableWithOrder) => {
      e.stopPropagation();
      setResizing({
        tableId: table.id,
        startX: e.clientX,
        startY: e.clientY,
        startW: table.width,
        startH: table.height,
      });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (resizing) {
        const dx = e.clientX - resizing.startX;
        const dy = e.clientY - resizing.startY;
        const newW = Math.max(60, Math.round((resizing.startW + dx) / 20) * 20);
        const newH = Math.max(60, Math.round((resizing.startH + dy) / 20) * 20);
        onTableResize(resizing.tableId, newW, newH);
        return;
      }

      if (!dragging || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - canvasRect.left - dragging.offsetX, canvasRect.width - 80));
      const y = Math.max(0, Math.min(e.clientY - canvasRect.top - dragging.offsetY, canvasRect.height - 80));

      const snappedX = Math.round(x / 20) * 20;
      const snappedY = Math.round(y / 20) * 20;

      onTableMove(dragging.tableId, snappedX, snappedY);
    },
    [dragging, resizing, onTableMove, onTableResize]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  const getOrderStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500';
      case 'preparing': return 'bg-blue-500';
      case 'ready': return 'bg-emerald-500';
      default: return 'bg-muted';
    }
  };

  const getTableStatusStyles = (table: TableWithOrder) => {
    // Order status takes priority over table status visually
    if (table.activeOrder) {
      const orderStatus = table.activeOrder.status;
      switch (orderStatus) {
        case 'pending': return { border: 'border-amber-500/50', bg: 'bg-card shadow-lg' };
        case 'preparing': return { border: 'border-blue-500/50', bg: 'bg-card shadow-lg' };
        case 'ready': return { border: 'border-emerald-500/50', bg: 'bg-card shadow-lg' };
      }
    }

    // Table status when no active order
    switch (table.table_status) {
      case 'reserved': return { border: 'border-violet-500/50', bg: 'bg-violet-500/10' };
      case 'dirty': return { border: 'border-orange-500/50', bg: 'bg-orange-500/10' };
      case 'unavailable': return { border: 'border-muted-foreground/30', bg: 'bg-muted/60 opacity-60' };
      default: return { border: 'border-border hover:border-primary/50', bg: 'bg-card/50' };
    }
  };

  const getTableStatusIcon = (status: string) => {
    switch (status) {
      case 'reserved': return <CalendarClock className="h-3 w-3 text-violet-500" />;
      case 'dirty': return <SprayCan className="h-3 w-3 text-orange-500" />;
      case 'unavailable': return <Ban className="h-3 w-3 text-muted-foreground" />;
      default: return null;
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative w-full h-full min-h-[600px] bg-muted/20',
        editMode && 'bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:20px_20px]'
      )}
      style={{ cursor: dragging ? 'grabbing' : 'default' }}
    >
      {tables.map((table) => {
        const isSelected = selectedTableId === table.id;
        const hasOrder = !!table.activeOrder;
        const elapsed = hasOrder
          ? formatDistanceToNow(new Date(table.activeOrder!.created_at), { addSuffix: false })
          : null;
        const styles = getTableStatusStyles(table);
        const statusIcon = !hasOrder ? getTableStatusIcon(table.table_status) : null;

        return (
          <div
            key={table.id}
            className={cn(
              'absolute flex flex-col items-center justify-center transition-all cursor-pointer select-none border-2',
              isSelected ? 'border-primary ring-2 ring-primary/30' : styles.border,
              styles.bg,
              editMode && 'cursor-grab',
              dragging?.tableId === table.id && 'cursor-grabbing opacity-80 scale-105'
            )}
            style={{
              left: table.position_x,
              top: table.position_y,
              width: table.width,
              height: table.height,
              borderRadius: table.shape === 'round' ? '50%' : '8px',
            }}
            onMouseDown={(e) => handleMouseDown(e, table)}
            onDoubleClick={() => editMode && onTableShapeToggle(table.id)}
          >
            {/* Status indicator dot */}
            <div
              className={cn(
                'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-background',
                hasOrder ? getOrderStatusColor(table.activeOrder?.status) : (
                  table.table_status === 'reserved' ? 'bg-violet-500' :
                  table.table_status === 'dirty' ? 'bg-orange-500' :
                  table.table_status === 'unavailable' ? 'bg-muted-foreground/40' :
                  'bg-muted'
                )
              )}
            />

            {/* Capacity badge */}
            <div className="absolute -bottom-1.5 -left-1.5 flex items-center gap-0.5 bg-background border border-border rounded-full px-1 py-0.5">
              <Users className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[9px] font-medium text-muted-foreground">{table.capacity}</span>
            </div>

            {/* Delete button in edit mode */}
            {editMode && isSelected && (
              <button
                className="absolute -top-2 -left-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                onClick={(e) => { e.stopPropagation(); onTableDelete(table.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}

            {/* Resize handle in edit mode */}
            {editMode && isSelected && (
              <div
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary rounded-sm cursor-se-resize border-2 border-background"
                onMouseDown={(e) => handleResizeStart(e, table)}
              />
            )}

            {/* Table status icon (when no order) */}
            {statusIcon && !hasOrder && (
              <div className="mb-0.5">{statusIcon}</div>
            )}

            {/* Table label */}
            <span className="text-xs font-semibold text-foreground truncate px-1">
              {table.label}
            </span>

            {/* Server name */}
            {table.server_name && (
              <span className="text-[9px] text-muted-foreground truncate px-1 max-w-full">
                {table.server_name}
              </span>
            )}

            {/* Order info with time elapsed */}
            {hasOrder && (
              <div className="text-[10px] text-center mt-0.5 px-1">
                <div className="font-medium text-foreground truncate">
                  {formatCents(table.activeOrder!.total_cents)}
                </div>
                <div className="text-muted-foreground truncate font-medium">
                  ⏱ {elapsed}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
