import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Users, Trash2 } from 'lucide-react';

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
      onTableMove(dragging.tableId, Math.round(x / 20) * 20, Math.round(y / 20) * 20);
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

  const getOrderIndicator = (status?: string) => {
    switch (status) {
      case 'pending': return 'bg-foreground/40';
      case 'preparing': return 'bg-foreground/60';
      case 'ready': return 'bg-foreground';
      default: return 'bg-muted-foreground/30';
    }
  };

  const getTableStyles = (table: TableWithOrder) => {
    if (table.activeOrder) {
      return {
        border: 'border-foreground/40',
        bg: 'bg-secondary',
      };
    }
    switch (table.table_status) {
      case 'reserved': return { border: 'border-foreground/30 border-dashed', bg: 'bg-secondary/60' };
      case 'dirty': return { border: 'border-foreground/20 border-dashed', bg: 'bg-muted/80' };
      case 'unavailable': return { border: 'border-muted-foreground/20', bg: 'bg-muted/40 opacity-50' };
      default: return { border: 'border-border hover:border-foreground/30', bg: 'bg-secondary/40' };
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative w-full h-full min-h-[600px] bg-background',
        editMode && 'bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:20px_20px]'
      )}
      style={{ cursor: dragging ? 'grabbing' : 'default' }}
    >
      {tables.map((table) => {
        const isSelected = selectedTableId === table.id;
        const hasOrder = !!table.activeOrder;
        const elapsed = hasOrder
          ? formatDistanceToNow(new Date(table.activeOrder!.created_at), { addSuffix: false })
          : null;
        const styles = getTableStyles(table);

        return (
          <div
            key={table.id}
            className={cn(
              'absolute flex flex-col items-center justify-center select-none border',
              'transition-all duration-150',
              isSelected ? 'border-foreground ring-1 ring-foreground/20' : styles.border,
              styles.bg,
              editMode ? 'cursor-grab' : 'cursor-pointer',
              dragging?.tableId === table.id && 'cursor-grabbing opacity-70 scale-[1.03]'
            )}
            style={{
              left: table.position_x,
              top: table.position_y,
              width: table.width,
              height: table.height,
              borderRadius: table.shape === 'round' ? '50%' : '6px',
            }}
            onMouseDown={(e) => handleMouseDown(e, table)}
            onDoubleClick={() => editMode && onTableShapeToggle(table.id)}
          >
            {/* Status dot */}
            <div
              className={cn(
                'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background',
                hasOrder ? getOrderIndicator(table.activeOrder?.status) : (
                  table.table_status === 'reserved' ? 'border-foreground/50 bg-transparent' :
                  table.table_status === 'dirty' ? 'bg-foreground/20 border-dashed' :
                  table.table_status === 'unavailable' ? 'bg-muted-foreground/20' :
                  'bg-muted-foreground/30'
                )
              )}
            />

            {/* Capacity */}
            <div className="absolute -bottom-1 -left-1 flex items-center gap-0.5 bg-background border border-border rounded-full px-1 py-0.5">
              <Users className="h-2 w-2 text-muted-foreground" />
              <span className="text-[8px] font-mono font-medium text-muted-foreground">{table.capacity}</span>
            </div>

            {/* Delete (edit mode) */}
            {editMode && isSelected && (
              <button
                className="absolute -top-2 -left-2 w-5 h-5 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                onClick={(e) => { e.stopPropagation(); onTableDelete(table.id); }}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}

            {/* Resize handle (edit mode) */}
            {editMode && isSelected && (
              <div
                className="absolute -bottom-1 -right-1 w-3 h-3 bg-foreground rounded-sm cursor-se-resize border-2 border-background"
                onMouseDown={(e) => handleResizeStart(e, table)}
              />
            )}

            {/* Label */}
            <span className="text-[11px] font-semibold text-foreground tracking-tight truncate px-1">
              {table.label}
            </span>

            {/* Server */}
            {table.server_name && (
              <span className="text-[8px] text-muted-foreground truncate px-1 max-w-full font-medium uppercase tracking-wider">
                {table.server_name}
              </span>
            )}

            {/* Order info */}
            {hasOrder && (
              <div className="text-center mt-0.5 px-1">
                <div className="text-[10px] font-mono font-semibold text-foreground">
                  {formatCents(table.activeOrder!.total_cents)}
                </div>
                <div className="text-[8px] text-muted-foreground font-mono">
                  {elapsed}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
