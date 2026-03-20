import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Link2, ChevronDown, ChevronRight, Trash2, Check, ExternalLink, AlertTriangle, Database } from 'lucide-react';
import { useAirtableConnection } from '@/hooks/use-airtable-connection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEFAULT_FIELD_MAPPING: Record<string, string> = {
  podcast_name: 'Podcast Name',
  action: 'Action',
  scheduled_date_time: 'Scheduled Date / Time',
  date_booked: 'Date Booked',
  date_published: 'Date Published',
  link_to_episode: 'Link to episode',
  show_notes: 'Show Notes',
  apple_podcast_link: 'Apple Podcast Link',
};

const FIELD_DESCRIPTIONS: Record<string, string> = {
  podcast_name: 'The name of the podcast (required)',
  action: 'Type of activity: podcast recording, intro call, etc.',
  scheduled_date_time: 'When the recording is scheduled',
  date_booked: 'When the booking was confirmed',
  date_published: 'When the episode was published',
  link_to_episode: 'URL to the published episode',
  show_notes: 'Episode description or notes',
  apple_podcast_link: 'Apple Podcasts URL',
};

interface AirtableBase {
  id: string;
  name: string;
}

interface AirtableTable {
  id: string;
  name: string;
  fields: Array<{ id: string; name: string; type: string }>;
}

/** Extract appXXX and tblYYY from an Airtable URL */
function parseAirtableUrl(url: string): { baseId: string; tableId: string; isSharedView: boolean } | null {
  try {
    const match = url.match(/airtable\.com\/(app[A-Za-z0-9]+)\/(tbl[A-Za-z0-9]+|shr[A-Za-z0-9]+|viw[A-Za-z0-9]+)/);
    if (!match) return null;
    const baseId = match[1];
    const secondSegment = match[2];
    const isSharedView = secondSegment.startsWith('shr');
    const tableId = secondSegment.startsWith('tbl') ? secondSegment : '';
    return { baseId, tableId, isSharedView };
  } catch {
    return null;
  }
}

interface AirtableConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  speakerId?: string;
  entityName: string;
  onConnectionSaved?: () => void;
}

export function AirtableConnectionDialog({
  open,
  onOpenChange,
  companyId,
  speakerId,
  entityName,
  onConnectionSaved,
}: AirtableConnectionDialogProps) {
  const {
    connection,
    isLoading,
    hasConnection,
    isCompanyFallback,
    saveConnection,
    deleteConnection,
  } = useAirtableConnection({ companyId, speakerId });

  // When "Create speaker-specific" is clicked, we override to treat as new
  const [forceNewSpeakerConnection, setForceNewSpeakerConnection] = useState(false);
  const effectiveHasConnection = hasConnection && !forceNewSpeakerConnection;
  const effectiveIsCompanyFallback = isCompanyFallback && !forceNewSpeakerConnection;

  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState('');
  const [tableId, setTableId] = useState('');
  const [token, setToken] = useState('');
  const [speakerColumnName, setSpeakerColumnName] = useState('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(DEFAULT_FIELD_MAPPING);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // URL parser state
  const [airtableUrl, setAirtableUrl] = useState('');
  const [urlParsed, setUrlParsed] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);

  // Browse state
  const [showBrowse, setShowBrowse] = useState(false);
  const [bases, setBases] = useState<AirtableBase[]>([]);
  const [tables, setTables] = useState<AirtableTable[]>([]);
  const [loadingBases, setLoadingBases] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');

  // Populate form when connection loads
  useEffect(() => {
    if (connection && !forceNewSpeakerConnection) {
      setName(connection.name || '');
      setBaseId(connection.base_id || '');
      setTableId(connection.table_id || '');
      setToken(connection.personal_access_token || '');
      setSpeakerColumnName(connection.speaker_column_name || '');
      setFieldMapping(connection.field_mapping || DEFAULT_FIELD_MAPPING);
    } else {
      setName(`${entityName} Activity`);
      setBaseId('');
      setTableId('');
      setToken('');
      setSpeakerColumnName('');
      setFieldMapping(DEFAULT_FIELD_MAPPING);
    }
    setAirtableUrl('');
    setUrlParsed(false);
    setIsSharedView(false);
  }, [connection, entityName, forceNewSpeakerConnection]);

  // URL parsing
  const handleUrlChange = useCallback((url: string) => {
    setAirtableUrl(url);
    if (!url.trim()) {
      setUrlParsed(false);
      setIsSharedView(false);
      return;
    }
    const parsed = parseAirtableUrl(url);
    if (parsed) {
      setBaseId(parsed.baseId);
      if (parsed.tableId) setTableId(parsed.tableId);
      setUrlParsed(true);
      setIsSharedView(parsed.isSharedView);
    } else {
      setUrlParsed(false);
      setIsSharedView(false);
    }
  }, []);

  // Browse bases
  const fetchBases = async () => {
    setLoadingBases(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-airtable-bases', {
        body: {},
      });
      if (error) throw error;
      setBases(data.bases || []);
      setShowBrowse(true);
    } catch (err: any) {
      toast.error('Failed to fetch Airtable bases', { description: err.message });
    } finally {
      setLoadingBases(false);
    }
  };

  // Browse tables for a base
  const fetchTables = async (bId: string) => {
    setLoadingTables(true);
    setTables([]);
    setSelectedTableId('');
    try {
      const { data, error } = await supabase.functions.invoke('list-airtable-bases', {
        body: { base_id: bId },
      });
      if (error) throw error;
      setTables(data.tables || []);
    } catch (err: any) {
      toast.error('Failed to fetch tables', { description: err.message });
    } finally {
      setLoadingTables(false);
    }
  };

  const handleBaseSelect = (bId: string) => {
    setSelectedBaseId(bId);
    setBaseId(bId);
    fetchTables(bId);
  };

  const handleTableSelect = (tId: string) => {
    setSelectedTableId(tId);
    setTableId(tId);

    // Auto-detect field mapping from table fields
    const table = tables.find(t => t.id === tId);
    if (table) {
      const fieldNames = table.fields.map(f => f.name);
      const newMapping = { ...fieldMapping };
      for (const [ourKey, defaultCol] of Object.entries(DEFAULT_FIELD_MAPPING)) {
        // Exact match first
        const exactMatch = fieldNames.find(fn => fn === defaultCol);
        if (exactMatch) {
          newMapping[ourKey] = exactMatch;
          continue;
        }
        // Case-insensitive match
        const ciMatch = fieldNames.find(fn => fn.toLowerCase() === defaultCol.toLowerCase());
        if (ciMatch) {
          newMapping[ourKey] = ciMatch;
        }
      }
      setFieldMapping(newMapping);
    }
  };

  const handleSave = async () => {
    if (!baseId.trim() || !tableId.trim()) return;

    setIsSaving(true);
    const success = await saveConnection({
      name: name.trim() || `${entityName} Activity`,
      base_id: baseId.trim(),
      table_id: tableId.trim(),
      personal_access_token: token.trim() || undefined,
      field_mapping: fieldMapping,
      speaker_column_name: speakerColumnName.trim() || undefined,
    });
    setIsSaving(false);

    if (success) {
      onConnectionSaved?.();
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    const success = await deleteConnection();
    if (success) {
      onOpenChange(false);
    }
  };

  const updateFieldMapping = (ourField: string, airtableColumn: string) => {
    setFieldMapping(prev => ({ ...prev, [ourField]: airtableColumn }));
  };

  const isValid = baseId.trim() && tableId.trim();
  const idsAutoFilled = urlParsed || (selectedBaseId && selectedTableId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {hasConnection ? 'Edit Airtable Connection' : 'Connect Airtable'}
          </DialogTitle>
          <DialogDescription>
            {hasConnection
              ? `Update the Airtable API connection for ${entityName}.`
              : `Set up a direct API connection to sync ${entityName}'s activity data from Airtable.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {hasConnection && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                <Check className="h-4 w-4 shrink-0" />
                <span>Connected to Airtable</span>
              </div>
            )}
            {/* Connection Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="e.g., Maya's Activity Table"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Paste Airtable URL */}
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <Label htmlFor="airtableUrl">Paste Airtable URL</Label>
              <Input
                id="airtableUrl"
                placeholder="https://airtable.com/appXXX/tblYYY/..."
                value={airtableUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
              {urlParsed && !isSharedView && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Check className="h-3 w-3" /> Base & Table detected
                </p>
              )}
              {urlParsed && isSharedView && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> This looks like a shared view link — paste the full table URL instead
                </p>
              )}
              {airtableUrl && !urlParsed && (
                <p className="text-xs text-muted-foreground">
                  Paste a URL like airtable.com/appXXX/tblYYY
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Browse Airtable */}
            {!showBrowse ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={fetchBases}
                disabled={loadingBases}
              >
                {loadingBases ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Browse Airtable
              </Button>
            ) : (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Browse Airtable
                </h4>
                <div className="space-y-2">
                  <Label>Base</Label>
                  <Select value={selectedBaseId} onValueChange={handleBaseSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a base..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bases.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBaseId && (
                  <div className="space-y-2">
                    <Label>Table</Label>
                    {loadingTables ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading tables...
                      </div>
                    ) : (
                      <Select value={selectedTableId} onValueChange={handleTableSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a table..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tables.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}





            {/* Field Mapping (Collapsible) */}
            <Collapsible open={showFieldMapping} onOpenChange={setShowFieldMapping}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    Field Mapping & Options
                    <Badge variant="secondary" className="font-normal">
                      {Object.keys(fieldMapping).length} fields
                    </Badge>
                  </span>
                  {showFieldMapping ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                {/* Speaker Column */}
                <div className="space-y-2">
                  <Label htmlFor="speakerColumn">Speaker Column (Optional)</Label>
                  <Input
                    id="speakerColumn"
                    placeholder="e.g., Speaker or Guest Name"
                    value={speakerColumnName}
                    onChange={(e) => setSpeakerColumnName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    If your table has multiple speakers, specify which column contains speaker names to filter by.
                  </p>
                </div>

                <div className="h-px bg-border" />

                <p className="text-xs text-muted-foreground">
                  Map your Airtable column names to our expected fields. Leave default if using standard names.
                </p>
                {Object.entries(fieldMapping).map(([ourField, airtableColumn]) => (
                  <div key={ourField} className="grid grid-cols-2 gap-2 items-center">
                    <div>
                      <Label className="text-xs capitalize">
                        {ourField.replace(/_/g, ' ')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {FIELD_DESCRIPTIONS[ourField]}
                      </p>
                    </div>
                    <Input
                      size={1}
                      placeholder="Airtable column name"
                      value={airtableColumn}
                      onChange={(e) => updateFieldMapping(ourField, e.target.value)}
                    />
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Last Synced */}
            {connection?.last_synced_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                Last synced: {new Date(connection.last_synced_at).toLocaleString()}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasConnection && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mr-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Connection
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Airtable Connection?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disconnect Airtable from {entityName}. You can reconnect anytime.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : hasConnection ? (
              'Update Connection'
            ) : (
              'Connect Airtable'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
