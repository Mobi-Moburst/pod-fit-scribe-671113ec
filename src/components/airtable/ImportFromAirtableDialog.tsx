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

interface ParsedClient {
  raw: string;
  speakerName: string;
  companyName: string;
  campaign_manager: string;
}

interface ExistingCompany {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCompanies: ExistingCompany[];
  onImportComplete: () => void;
}

/** Split "Speaker Name - Company Name" into parts; if no delimiter, both are the raw name */
function parseClientName(raw: string): { speakerName: string; companyName: string } {
  const idx = raw.indexOf(' - ');
  if (idx === -1) return { speakerName: raw, companyName: raw };
  return { speakerName: raw.slice(0, idx).trim(), companyName: raw.slice(idx + 3).trim() };
}

/** Check if any part of the parsed client name matches an existing company (handles reversed formats) */
function findExistingCompanyFromParsed(
  parsed: { raw: string; speakerName: string; companyName: string },
  existing: ExistingCompany[]
): ExistingCompany | undefined {
  for (const candidate of [parsed.companyName, parsed.speakerName, parsed.raw]) {
    const lower = candidate.toLowerCase();
    const match = existing.find(c => c.name.toLowerCase() === lower);
    if (match) return match;
  }
  return undefined;
}

export function ImportFromAirtableDialog({ open, onOpenChange, existingCompanies, onImportComplete }: Props) {
  const [baseId, setBaseId] = useState('appKSO0Fu50JdheHt');
  const [tableId, setTableId] = useState('tblJelP3ssvAGvhYb');
  const [clientColumn, setClientColumn] = useState('Client');
  const [cmColumn, setCmColumn] = useState('Campaign Manager');

  const [clients, setClients] = useState<ParsedClient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scanned, setScanned] = useState(false);

  const { toast } = useToast();

  const isExisting = (c: ParsedClient) => !!findExistingCompanyFromParsed(c, existingCompanies);

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
      const parsed: ParsedClient[] = fetched.map(c => ({
        raw: c.name,
        ...parseClientName(c.name),
        campaign_manager: c.campaign_manager,
      }));
      setClients(parsed);

      // Auto-select names that don't already exist
      const autoSelected = new Set<string>();
      parsed.forEach(c => {
        if (!findExistingCompanyFromParsed(c, existingCompanies)) {
          autoSelected.add(c.raw);
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

  const newClients = clients.filter(c => !isExisting(c));
  const existingCount = clients.length - newClients.length;

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(newClients.map(c => c.raw)));
    } else {
      setSelected(new Set());
    }
  };

  const toggle = (raw: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(raw)) next.delete(raw);
      else next.add(raw);
      return next;
    });
  };

  const importSelected = async () => {
    const toImport = clients.filter(c => selected.has(c.raw));
    if (!toImport.length) return;

    setIsImporting(true);
    try {
      // Group by whether the company already exists
      const needNewCompany: ParsedClient[] = [];
      const linkToExisting: { client: ParsedClient; existingCompanyId: string }[] = [];

      for (const c of toImport) {
        const match = findExistingCompanyFromParsed(c, existingCompanies);
        if (match) {
          linkToExisting.push({ client: c, existingCompanyId: match.id });
        } else {
          needNewCompany.push(c);
        }
      }

      // 1. Create new companies (deduplicate by companyName)
      const uniqueNewCompanies = new Map<string, ParsedClient>();
      needNewCompany.forEach(c => {
        if (!uniqueNewCompanies.has(c.companyName.toLowerCase())) {
          uniqueNewCompanies.set(c.companyName.toLowerCase(), c);
        }
      });

      const companyRows = Array.from(uniqueNewCompanies.values()).map(c => ({
        org_id: TEAM_ORG_ID,
        name: c.companyName,
        campaign_manager: c.campaign_manager || null,
      }));

      let newCompanyMap = new Map<string, string>(); // companyName lower → id
      if (companyRows.length) {
        const { data: insertedCompanies, error: compErr } = await supabase
          .from('companies')
          .insert(companyRows)
          .select('id, name');
        if (compErr) throw compErr;
        insertedCompanies?.forEach((comp: any) => {
          newCompanyMap.set(comp.name.toLowerCase(), comp.id);
        });
      }

      // 2. Create speakers for all imported clients
      const speakerRows = toImport.map(c => {
        const match = findExistingCompany(c.companyName, existingCompanies);
        const companyId = match ? match.id : newCompanyMap.get(c.companyName.toLowerCase());
        return {
          org_id: TEAM_ORG_ID,
          company_id: companyId!,
          name: c.speakerName,
        };
      });

      const { error: spkErr } = await supabase.from('speakers').insert(speakerRows);
      if (spkErr) throw spkErr;

      const newCompanyCount = companyRows.length;
      const newSpeakerCount = speakerRows.length;
      toast({
        title: `Imported ${newSpeakerCount} speaker${newSpeakerCount === 1 ? '' : 's'}`,
        description: `${newCompanyCount} new compan${newCompanyCount === 1 ? 'y' : 'ies'} created, ${linkToExisting.length} linked to existing.`,
      });
      onImportComplete();
      onOpenChange(false);

      // Reset
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

  const selectedCount = clients.filter(c => selected.has(c.raw)).length;

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
              <span>{newClients.length} new · {existingCount} already exist · {selectedCount} selected</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedCount === newClients.length && newClients.length > 0}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
                <span>All new</span>
              </label>
            </div>

            <ScrollArea className="max-h-64 border rounded-md">
              <div className="divide-y divide-border">
                {newClients.map(c => {
                  const hasSplit = c.speakerName !== c.companyName;
                  return (
                    <label
                      key={c.raw}
                      className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selected.has(c.raw)}
                        onCheckedChange={() => toggle(c.raw)}
                      />
                      <div className="flex-1 min-w-0">
                        {hasSplit ? (
                          <>
                            <span className="block truncate">{c.speakerName}</span>
                            <span className="block text-xs text-muted-foreground truncate">{c.companyName}</span>
                          </>
                        ) : (
                          <span className="block truncate">{c.raw}</span>
                        )}
                      </div>
                      {c.campaign_manager && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{c.campaign_manager}</span>
                      )}
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
            <Button onClick={importSelected} disabled={isImporting || selectedCount === 0}>
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Import {selectedCount} {selectedCount === 1 ? 'Speaker' : 'Speakers'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
