import { useState, useEffect } from 'react';
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
import { Loader2, Link2, ChevronDown, ChevronRight, Trash2, Check, ExternalLink } from 'lucide-react';
import { useAirtableConnection, AirtableConnection } from '@/hooks/use-airtable-connection';

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

interface AirtableConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  speakerId?: string;
  entityName: string; // For display: "Maya Reynolds" or "Acme Inc."
}

export function AirtableConnectionDialog({
  open,
  onOpenChange,
  companyId,
  speakerId,
  entityName,
}: AirtableConnectionDialogProps) {
  const {
    connection,
    isLoading,
    hasConnection,
    saveConnection,
    deleteConnection,
  } = useAirtableConnection({ companyId, speakerId });

  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState('');
  const [tableId, setTableId] = useState('');
  const [token, setToken] = useState('');
  const [speakerColumnName, setSpeakerColumnName] = useState('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(DEFAULT_FIELD_MAPPING);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Populate form when connection loads
  useEffect(() => {
    if (connection) {
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
  }, [connection, entityName]);

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

            {/* Airtable Connection Details */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Airtable Connection</h4>
                <Badge variant="secondary" className="text-xs">
                  Using shared API access
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseId">
                    Base ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="baseId"
                    placeholder="appXXXXXXXXXXXXXX"
                    value={baseId}
                    onChange={(e) => setBaseId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    From your Airtable URL after /app
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tableId">
                    Table ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tableId"
                    placeholder="tblXXXXXXXXXXXXXX"
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    From your Airtable URL after /tbl
                  </p>
                </div>
              </div>
            </div>

            {/* Advanced: Custom Token (Collapsible) */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                  <span>Advanced: Custom API Token</span>
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3 px-1">
                <div className="space-y-2">
                  <Label htmlFor="token">Personal Access Token</Label>
                  <Input
                    id="token"
                    type="password"
                    placeholder="pat... (optional - uses shared token if empty)"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only needed if you want to use a different Airtable account for this connection.{' '}
                    <a
                      href="https://airtable.com/create/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Get token <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Multi-Speaker Column */}
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

            {/* Field Mapping (Collapsible) */}
            <Collapsible open={showFieldMapping} onOpenChange={setShowFieldMapping}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    Field Mapping
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
