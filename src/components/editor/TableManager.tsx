import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, QrCode, Download } from 'lucide-react';
import { toast } from 'sonner';
import { generateUUID } from '@/lib/utils/uuid';
import { QRCodeSVG } from 'qrcode.react';

interface TableManagerProps {
  restaurantId: string;
  menuUrl?: string; // base menu URL like /m/abc123/00001
}

interface RestaurantTable {
  id: string;
  label: string;
  qr_code_id: string;
  active: boolean;
}

export const TableManager = ({ restaurantId, menuUrl }: TableManagerProps) => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedQr, setSelectedQr] = useState<RestaurantTable | null>(null);

  const fetchTables = async () => {
    const { data } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at');
    setTables(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTables(); }, [restaurantId]);

  const addTable = async () => {
    if (!newLabel.trim()) return;

    const qrCodeId = generateUUID().slice(0, 8);

    const { error } = await supabase.from('restaurant_tables').insert({
      restaurant_id: restaurantId,
      label: newLabel.trim(),
      qr_code_id: qrCodeId,
    });

    if (error) {
      toast.error('Failed to add table');
      return;
    }

    setNewLabel('');
    fetchTables();
    toast.success('Table added');
  };

  const removeTable = async (id: string) => {
    await supabase.from('restaurant_tables').delete().eq('id', id);
    fetchTables();
    toast.success('Table removed');
  };

  const getTableQrUrl = (table: RestaurantTable) => {
    if (!menuUrl) return '';
    return `${window.location.origin}${menuUrl}?table=${table.qr_code_id}`;
  };

  const downloadQr = (table: RestaurantTable) => {
    const svgEl = document.getElementById(`qr-${table.id}`) as unknown as SVGElement;
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.download = `${table.label.replace(/\s+/g, '-')}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Table Management</h3>
        <p className="text-sm text-muted-foreground">Add tables and generate QR codes for dine-in ordering</p>
      </div>

      {/* Add table */}
      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Table name (e.g., Table 1, Bar 2)"
          onKeyDown={(e) => e.key === 'Enter' && addTable()}
        />
        <Button onClick={addTable} disabled={!newLabel.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {/* Table list */}
      <div className="space-y-2">
        {tables.map((table) => (
          <div key={table.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <span className="font-medium text-foreground">{table.label}</span>
              <Badge variant="outline" className="text-xs font-mono">{table.qr_code_id}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedQr(selectedQr?.id === table.id ? null : table)}>
                <QrCode className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeTable(table.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {!loading && tables.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No tables yet. Add one above.</p>
        )}
      </div>

      {/* QR Preview */}
      {selectedQr && menuUrl && (
        <div className="p-6 rounded-xl border border-border bg-card/50 text-center space-y-4">
          <h4 className="font-semibold text-foreground">{selectedQr.label}</h4>
          <div className="flex justify-center">
            <QRCodeSVG
              id={`qr-${selectedQr.id}`}
              value={getTableQrUrl(selectedQr)}
              size={200}
              level="H"
            />
          </div>
          <p className="text-xs text-muted-foreground break-all">{getTableQrUrl(selectedQr)}</p>
          <Button variant="outline" onClick={() => downloadQr(selectedQr)}>
            <Download className="h-4 w-4 mr-1" /> Download PNG
          </Button>
        </div>
      )}
    </div>
  );
};
