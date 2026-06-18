import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Mic, Ticket } from "lucide-react";
import {
  IntegrationCard,
  IntegrationStatus,
} from "@/components/integrations/IntegrationCard";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Integrations() {
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  const [ffStatus, setFfStatus] = useState<IntegrationStatus>("loading");
  const [ffMeta, setFfMeta] = useState<string | null>(null);

  const [hsStatus, setHsStatus] = useState<IntegrationStatus>("loading");
  const [hsMeta, setHsMeta] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Integrations — Kitcaster Campaign Command Center";
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("fireflies_connections")
        .select("fireflies_email, last_synced_at, last_sync_status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        setFfStatus("not_connected");
        setFfMeta("Connect your Fireflies API key to sync meetings.");
      } else if (data.last_sync_status === "error") {
        setFfStatus("error");
        setFfMeta(`Last sync failed • ${timeAgo(data.last_synced_at)}`);
      } else {
        setFfStatus("connected");
        setFfMeta(
          `${data.fireflies_email || "Connected"} • Last sync ${timeAgo(data.last_synced_at)}`
        );
      }
    })();
  }, [user]);

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) {
      setHsStatus("admin_only");
      setHsMeta("Pipeline mapping and ticket sync (admin only).");
      return;
    }
    (async () => {
      const [{ data: settings }, { count }, { data: latest }] = await Promise.all([
        supabase.from("hubspot_settings").select("pipeline_label, pipeline_id").maybeSingle(),
        supabase.from("hubspot_tickets_cache").select("hubspot_ticket_id", { count: "exact", head: true }),
        supabase
          .from("hubspot_tickets_cache")
          .select("synced_at")
          .order("synced_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!settings?.pipeline_id) {
        setHsStatus("needs_config");
        setHsMeta("Pipeline not yet selected.");
      } else {
        setHsStatus("connected");
        setHsMeta(
          `${settings.pipeline_label || "Pipeline set"} • ${count ?? 0} tickets cached • Last sync ${timeAgo(latest?.synced_at || null)}`
        );
      }
    })();
  }, [isAdmin, roleLoading]);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto py-8 px-4 space-y-6 relative z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect external tools so the Command Center can pull data on your behalf.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <IntegrationCard
            to="/settings/integrations/hubspot"
            icon={Ticket}
            title="HubSpot"
            description="Sync tickets, map pipeline stages, and backfill historical activity."
            status={hsStatus}
            meta={hsMeta}
          />
          <IntegrationCard
            to="/settings/integrations/fireflies"
            icon={Mic}
            title="Fireflies Notetaker"
            description="Pull your meeting notes into the Command Center automatically."
            status={ffStatus}
            meta={ffMeta}
          />
        </div>
      </main>
    </div>
  );
}
