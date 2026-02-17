import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Download, Search } from 'lucide-react';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AirtableClient {
  name: string;
  campaign_manager: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCompanyNames: string[];
  onImportComplete: () => void;
}

export function ImportFromAirtableDialog({ open, onOpenChange, existingCompanyNames, onImportComplete }: Props) {
  const [baseId, setBaseId] = useState('appKSO0Fu50JdheHt');
  const [tableId, setTableId] = useState('tblJelP3ssvAGvhYb');
  const [clientColumn, setClientColumn] = useState('Client');
  const [cmColumn, setCmColumn] = useState('Campaign Manager');

  const [clients, setClients] = useState<AirtableClient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scanned, setScanned] = useState(false);

  const { toast } = useToast();

  const existingLower = new Set(existingCompanyNames.map(n => n.toLowerCase()));

  const scan = async () => {
    setIsScanning(true);
    setScanned(false);
    setClients([]);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke('import-airtable-clients', {
        body: { base_id: baseId, table_id: tableId, client_column: clientColumn, campaign_manager_column: cmColumn },
      });
      if (error) throw error;
      if (!data?.clients) throw new Error('No data returned');

      const fetched: AirtableClient[] = data.clients;
      setClients(fetched);

      // Auto-select names that don't already exist
      const autoSelected = new Set<string>();
      fetched.forEach(c => {
        if (!existingLower.has(c.name.toLowerCase())) {
          autoSelected.add(c.name);
        }
      });
      setSelected(autoSelected);
      setScanned(true);
    } catch (err) {
      console.error('Scan failed:', err);
      toast({ title: 'Scan failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const all = new Set<string>();
      clients.forEach(c => {
        if (!existingLower.has(c.name.toLowerCase())) all.add(c.name);
      });
      setSelected(all);
    } else {
      setSelected(new Set());
    }
  };

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const importSelected = async () => {
    const toImport = clients.filter(c => selected.has(c.name));
    if (!toImport.length) return;

    setIsImporting(true);
    try {
      // Batch create companies
      const companyRows = toImport.map(c => ({
        org_id: TEAM_ORG_ID,
        name: c.name,
        campaign_manager: c.campaign_manager || null,
      }));

      const { data: insertedCompanies, error: compErr } = await supabase
        .from('companies')
        .insert(companyRows)
        .select('id, name');

      if (compErr) throw compErr;

      // Create a matching speaker for each company
      if (insertedCompanies?.length) {
        const speakerRows = insertedCompanies.map((comp: any) => ({
          org_id: TEAM_ORG_ID,
          company_id: comp.id,
          name: comp.name,
        }));

        const { error: spkErr } = await supabase.from('speakers').insert(speakerRows);
        if (spkErr) throw spkErr;
      }

      toast({ title: `Imported ${toImport.length} companies`, description: 'You can now edit them to fill in details.' });
      onImportComplete();
      onOpenChange(false);

      // Reset state for next open
      setClients([]);
      setSelected(new Set());
      setScanned(false);
    } catch (err) {
      console.error('Import failed:', err);
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const newCount = clients.filter(c => selected.has(c.name)).length;
  const existingCount = clients.filter(c => existingLower.has(c.name.toLowerCase())).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Airtable</DialogTitle>
          <DialogDescription>Pull client names from an Airtable table and create company + speaker records.</DialogDescription>
        </DialogHeader>

        {/* Config fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Base ID</Label>
            <Input value={baseId} onChange={e => setBaseId(e.target.value)} placeholder="appXXX" className="text-xs h-8" />
          </div>
          <div>
            <Label className="text-xs">Table ID</Label>
            <Input value={tableId} onChange={e => setTableId(e.target.value)} placeholder="tblXXX" className="text-xs h-8" />
          </div>
          <div>
            <Label className="text-xs">Client Column</Label>
            <Input value={clientColumn} onChange={e => setClientColumn(e.target.value)} className="text-xs h-8" />
          </div>
          <div>
            <Label className="text-xs">Campaign Manager Column</Label>
            <Input value={cmColumn} onChange={e => setCmColumn(e.target.value)} className="text-xs h-8" />
          </div>
        </div>

        <Button onClick={scan} disabled={isScanning || !baseId || !tableId} variant="outline" className="w-full">
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          {isScanning ? 'Scanning…' : 'Scan Airtable'}
        </Button>

        {/* Results */}
        {scanned && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{clients.length} clients found · {existingCount} already exist · {newCount} selected</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={newCount === clients.length - existingCount && newCount > 0}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
                <span>All new</span>
              </label>
            </div>

            <ScrollArea className="max-h-64 border rounded-md">
              <div className="divide-y divide-border">
                {clients.map(c => {
                  const exists = existingLower.has(c.name.toLowerCase());
                  return (
                    <label
                      key={c.name}
                      className={`flex items-center gap-3 px-3 py-2 text-sm ${exists ? 'opacity-50' : 'cursor-pointer hover:bg-muted/40'}`}
                    >
                      <Checkbox
                        checked={selected.has(c.name)}
                        onCheckedChange={() => toggle(c.name)}
                        disabled={exists}
                      />
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.campaign_manager && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{c.campaign_manager}</span>
                      )}
                      {exists && <span className="text-xs text-muted-foreground italic">exists</span>}
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {scanned && (
            <Button onClick={importSelected} disabled={isImporting || newCount === 0}>
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Import {newCount} {newCount === 1 ? 'Company' : 'Companies'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
