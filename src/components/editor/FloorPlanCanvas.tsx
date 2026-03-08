import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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

interface FloorPlanCanvasProps {
  tables: TableWithOrder[];
  editMode: boolean;
  selectedTableId?: string;
  onTableMove: (tableId: string, x: number, y: number) => void;
  onTableSelect: (table: TableWithOrder) => void;
}

export function FloorPlanCanvas({
  tables,
  editMode,
  selectedTableId,
  onTableMove,
  onTableSelect,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ tableId: string; offsetX: number; offsetY: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, table: TableWithOrder) => {
      if (!editMode) {
        onTableSelect(table);
        return;
      }

      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setDragging({
        tableId: table.id,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      });
    },
    [editMode, onTableSelect]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - canvasRect.left - dragging.offsetX, canvasRect.width - 80));
      const y = Math.max(0, Math.min(e.clientY - canvasRect.top - dragging.offsetY, canvasRect.height - 80));

      // Snap to grid (20px)
      const snappedX = Math.round(x / 20) * 20;
      const snappedY = Math.round(y / 20) * 20;

      onTableMove(dragging.tableId, snappedX, snappedY);
    },
    [dragging, onTableMove]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500';
      case 'preparing':
        return 'bg-blue-500';
      case 'ready':
        return 'bg-emerald-500';
      default:
        return 'bg-muted';
    }
  };

  const formatCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative w-full h-full min-h-[600px] bg-muted/20',
        editMode && 'bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:20px_20px]'
      )}
      style={{ cursor: dragging ? 'grabbing' : 'default' }}
    >
      {tables.map((table) => (
        <div
          key={table.id}
          className={cn(
            'absolute flex flex-col items-center justify-center rounded-lg border-2 transition-all cursor-pointer select-none',
            selectedTableId === table.id
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-border hover:border-primary/50',
            table.activeOrder ? 'bg-card shadow-lg' : 'bg-card/50',
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
        >
          {/* Status indicator */}
          <div
            className={cn(
              'absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background',
              getStatusColor(table.activeOrder?.status)
            )}
          />

          {/* Table label */}
          <span className="text-xs font-semibold text-foreground truncate px-1">
            {table.label}
          </span>

          {/* Order info */}
          {table.activeOrder && (
            <div className="text-[10px] text-center mt-1 px-1">
              <div className="font-medium text-foreground truncate max-w-full">
                {formatCents(table.activeOrder.total_cents)}
              </div>
              <div className="text-muted-foreground truncate">
                {formatDistanceToNow(new Date(table.activeOrder.created_at), { addSuffix: false })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
