import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Link2, Settings } from 'lucide-react';
import { useAirtableConnection, AirtableCSVRow } from '@/hooks/use-airtable-connection';
import { AirtableConnectionDialog } from './AirtableConnectionDialog';

interface AirtableSyncButtonProps {
  companyId?: string;
  speakerId?: string;
  entityName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  speakerName?: string; // For multi-speaker table filtering
  onDataSynced: (data: AirtableCSVRow[]) => void;
  variant?: 'default' | 'compact' | 'inline';
  size?: 'default' | 'sm';
}

export function AirtableSyncButton({
  companyId,
  speakerId,
  entityName,
  dateRangeStart,
  dateRangeEnd,
  speakerName,
  onDataSynced,
  variant = 'default',
  size = 'default',
}: AirtableSyncButtonProps) {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const { connection, hasConnection, isSyncing, syncData, refreshConnection } = useAirtableConnection({
    companyId,
    speakerId,
  });

  const handleSync = async () => {
    const data = await syncData({
      dateRangeStart,
      dateRangeEnd,
      speakerName,
    });
    
    if (data) {
      onDataSynced(data);
    }
  };

  const handleConnectionSaved = async () => {
    // Refresh connection state, then auto-sync
    await refreshConnection();
    // Small delay to let state settle, then trigger sync
    setTimeout(async () => {
      const data = await syncData({
        dateRangeStart,
        dateRangeEnd,
        speakerName,
      });
      if (data) {
        onDataSynced(data);
      }
    }, 300);
  };

  // Inline variant - just a sync button, no connection UI
  if (variant === 'inline') {
    if (!hasConnection) {
      return (
        <>
          <Button
            variant="outline"
            size={size}
            onClick={() => setShowConnectionDialog(true)}
            className="gap-1"
          >
            <Link2 className="h-4 w-4" />
            Connect Airtable
          </Button>
          <AirtableConnectionDialog
            open={showConnectionDialog}
            onOpenChange={setShowConnectionDialog}
            companyId={companyId}
            speakerId={speakerId}
            entityName={entityName}
            onConnectionSaved={handleConnectionSaved}
          />
        </>
      );
    }

    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleSync}
        disabled={isSyncing}
        className="gap-1"
      >
        {isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Sync from Airtable
          </>
        )}
      </Button>
    );
  }

  if (variant === 'compact') {
    if (!hasConnection) {
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConnectionDialog(true)}
            className="gap-1"
          >
            <Link2 className="h-3 w-3" />
            Connect
          </Button>
          <AirtableConnectionDialog
            open={showConnectionDialog}
            onOpenChange={setShowConnectionDialog}
            companyId={companyId}
            speakerId={speakerId}
            entityName={entityName}
          />
        </>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="gap-1"
        >
          {isSyncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Sync
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowConnectionDialog(true)}
        >
          <Settings className="h-3 w-3" />
        </Button>
        <AirtableConnectionDialog
          open={showConnectionDialog}
          onOpenChange={setShowConnectionDialog}
          companyId={companyId}
          speakerId={speakerId}
          entityName={entityName}
        />
      </div>
    );
  }

  // Default variant
  if (!hasConnection) {
    return (
      <>
        <div className="flex items-center gap-3 p-3 border border-dashed rounded-lg">
          <Link2 className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Connect Airtable</p>
            <p className="text-xs text-muted-foreground">
              Sync activity data directly instead of uploading CSVs
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConnectionDialog(true)}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Connect
          </Button>
        </div>
        <AirtableConnectionDialog
          open={showConnectionDialog}
          onOpenChange={setShowConnectionDialog}
          companyId={companyId}
          speakerId={speakerId}
          entityName={entityName}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
        <Link2 className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{connection?.name}</p>
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          </div>
          {connection?.last_synced_at && (
            <p className="text-xs text-muted-foreground">
              Last synced: {new Date(connection.last_synced_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowConnectionDialog(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <AirtableConnectionDialog
        open={showConnectionDialog}
        onOpenChange={setShowConnectionDialog}
        companyId={companyId}
        speakerId={speakerId}
        entityName={entityName}
      />
    </>
  );
}
