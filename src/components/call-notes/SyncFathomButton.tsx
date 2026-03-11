import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Loader2, Link2 } from "lucide-react";

interface SyncFathomButtonProps {
  onSyncComplete?: () => void;
}

export function SyncFathomButton({ onSyncComplete }: SyncFathomButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [rematching, setRematching] = useState(false);
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
      const message = err instanceof Error ? err.message : "Unknown error";
      const isDns = message.includes("dns") || message.includes("lookup") || message.includes("sending request");
      toast({
        title: "Sync failed",
        description: isDns
          ? "Could not reach Fathom API (DNS error). Try again later, or use Re-match to link existing notes."
          : message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRematch = async () => {
    setRematching(true);
    try {
      const { data, error } = await supabase.functions.invoke("rematch-call-notes");
      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Re-match complete",
          description: `Matched ${data.matched} of ${data.total} unlinked note${data.total !== 1 ? "s" : ""}.`,
        });
        if (data.matched > 0) onSyncComplete?.();
      } else {
        throw new Error(data?.error || "Re-match failed");
      }
    } catch (err) {
      console.error("Rematch error:", err);
      toast({
        title: "Re-match failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRematching(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || rematching}>
        {syncing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Sync from Fathom
      </Button>
      <Button variant="outline" size="sm" onClick={handleRematch} disabled={syncing || rematching}>
        {rematching ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Link2 className="h-4 w-4 mr-2" />
        )}
        Re-match
      </Button>
    </div>
  );
}
