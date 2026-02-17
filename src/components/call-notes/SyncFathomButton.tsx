import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Loader2 } from "lucide-react";

interface SyncFathomButtonProps {
  onSyncComplete?: () => void;
}

export function SyncFathomButton({ onSyncComplete }: SyncFathomButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-fathom-meetings");
      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Fathom sync complete",
          description: `Imported ${data.imported} new meeting${data.imported !== 1 ? "s" : ""}, skipped ${data.skipped}.`,
        });
      } else {
        throw new Error(data?.error || "Sync failed");
      }

      onSyncComplete?.();
    } catch (err) {
      console.error("Fathom sync error:", err);
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
      {syncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Sync from Fathom
    </Button>
  );
}
