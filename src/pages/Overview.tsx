import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LtvRow = {
  id: string;
  company_id: string | null;
  client_name: string;
  campaign_manager: string | null;
  cohort: string | null;
  primary_industry: string | null;
  status: string | null;
  campaign_success_status: string | null;
  cumulative_pct_fulfilled: number | null;
  current_month_cumulative_pct_fulfilled: number | null;
  deliverables_completed_this_month: number | null;
  trend_vs_last_month: string | null;
  renewal_date: string | null;
  renewed: boolean | null;
  last_client_checkin: string | null;
  zz_complete: boolean | null;
  synced_at: string;
};


const ACTIVE_STATUSES = new Set(["On track", "Behind", "Billing Paused"]);

function isActive(r: LtvRow) {
  if (r.zz_complete === true) return false;
  return ACTIVE_STATUSES.has(r.status ?? "");
}

function isAtRisk(r: LtvRow) {
  if (!isActive(r)) return false;
  const css = (r.campaign_success_status ?? "").toLowerCase();
  if (css === "red") return true;
  if (r.status === "Behind" && (r.cumulative_pct_fulfilled ?? 100) < 70) return true;
  return false;
}

function needsAttention(r: LtvRow) {
  if (!isActive(r)) return false;
  const css = (r.campaign_success_status ?? "").toLowerCase();
  if (css === "yellow") return true;
  if (r.status === "Behind") return true;
  return false;
}

function isOnTrack(r: LtvRow) {
  if (!isActive(r)) return false;
  return (r.campaign_success_status ?? "").toLowerCase() === "green";
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date).getTime();
  const now = Date.now();
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

function trendIcon(t: string | null) {
  if (!t) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const n = parseFloat(t);
  if (isNaN(n) || n === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (n > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

function statusBadge(css: string | null, status: string | null) {
  const s = (css ?? "").toLowerCase();
  const map: Record<string, string> = {
    green: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    yellow: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    red: "bg-red-500/15 text-red-500 border-red-500/30",
    offboarding: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };
  const label = css || status || "Unknown";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
        map[s] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      {label}
    </span>
  );
}

const Overview = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<LtvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cmFilter, setCmFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  useEffect(() => {
    document.title = "Overview — Kitcaster Campaign Command Center";
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ltv_snapshots")
      .select(
        "id, client_name, campaign_manager, cohort, primary_industry, status, campaign_success_status, cumulative_pct_fulfilled, current_month_cumulative_pct_fulfilled, deliverables_completed_this_month, trend_vs_last_month, renewal_date, renewed, last_client_checkin, zz_complete, synced_at"
      )
      .order("client_name");
    if (error) {
      toast({ title: "Failed to load LTV data", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as LtvRow[]);
    }
    setLoading(false);
  }

  async function sync() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-ltv-snapshots");
    setSyncing(false);
    if (error) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "LTV synced",
      description: `${(data as any)?.upserted ?? 0} rows · ${(data as any)?.matched_to_companies ?? 0} matched to companies`,
    });
    load();
  }

  const managers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.campaign_manager && set.add(r.campaign_manager));
    return Array.from(set).sort();
  }, [rows]);

  // Globally exclude completed/offboarded clients (ZZ - Complete in Airtable)
  const livingRows = useMemo(() => rows.filter((r) => r.zz_complete !== true), [rows]);

  const filtered = useMemo(() => {
    return livingRows.filter((r) => {
      if (cmFilter !== "all" && r.campaign_manager !== cmFilter) return false;
      if (statusFilter === "active" && !isActive(r)) return false;
      if (statusFilter === "at_risk" && !isAtRisk(r)) return false;
      if (statusFilter === "needs_attention" && !needsAttention(r)) return false;
      if (statusFilter === "on_track" && !isOnTrack(r)) return false;
      if (statusFilter === "renewing_soon") {
        const d = daysUntil(r.renewal_date);
        if (d === null || d > 60 || d < 0) return false;
      }
      return true;
    });
  }, [livingRows, cmFilter, statusFilter]);

  const scope = useMemo(
    () => (cmFilter === "all" ? livingRows : livingRows.filter((r) => r.campaign_manager === cmFilter)),
    [livingRows, cmFilter]
  );

  const kpis = useMemo(() => {
    const active = scope.filter(isActive);
    const onTrack = scope.filter(isOnTrack).length;
    const attention = scope.filter(needsAttention).length;
    const atRisk = scope.filter(isAtRisk).length;
    const renewingSoon = scope.filter((r) => {
      const d = daysUntil(r.renewal_date);
      return d !== null && d >= 0 && d <= 60;
    }).length;
    const avgFulfillment =
      active.length === 0
        ? 0
        : Math.round(
            active.reduce(
              (sum, r) => sum + (r.current_month_cumulative_pct_fulfilled ?? 0),
              0
            ) / active.length
          );
    return {
      active: active.length,
      onTrack,
      attention,
      atRisk,
      renewingSoon,
      avgFulfillment,
    };
  }, [scope]);

  const needsAttentionFeed = useMemo(() => {
    const items: Array<{ row: LtvRow; reason: string; severity: "high" | "med" }> = [];
    for (const r of scope) {
      if (!isActive(r)) continue;
      const css = (r.campaign_success_status ?? "").toLowerCase();
      if (css === "red") {
        items.push({ row: r, reason: "Campaign at risk (Red)", severity: "high" });
      } else if (r.status === "Behind" && (r.cumulative_pct_fulfilled ?? 100) < 70) {
        items.push({
          row: r,
          reason: `Behind pace — ${Math.round(r.cumulative_pct_fulfilled ?? 0)}% fulfilled overall`,
          severity: "high",
        });
      } else if (css === "yellow") {
        items.push({ row: r, reason: "Needs attention (Yellow)", severity: "med" });
      }
      const dRenew = daysUntil(r.renewal_date);
      if (dRenew !== null && dRenew >= 0 && dRenew <= 30 && !r.renewed) {
        items.push({
          row: r,
          reason: `Renewal in ${dRenew}d — not yet renewed`,
          severity: dRenew <= 14 ? "high" : "med",
        });
      }
      const dCheck = daysUntil(r.last_client_checkin);
      if (dCheck !== null && dCheck <= -21) {
        items.push({
          row: r,
          reason: `No check-in in ${Math.abs(dCheck)}d`,
          severity: "med",
        });
      }
    }
    return items
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1))
      .slice(0, 12);
  }, [scope]);

  const lastSynced = rows[0]?.synced_at;

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold mb-1">Overview</h1>
            <p className="text-sm text-muted-foreground">
              Pulse-check on active Kitcaster campaigns, sourced from the LTV
              tracker.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastSynced && (
              <span className="text-xs text-muted-foreground">
                Synced {new Date(lastSynced).toLocaleString()}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync LTV"}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={cmFilter} onValueChange={setCmFilter}>
            <SelectTrigger className="w-56 h-8 text-sm">
              <SelectValue placeholder="Campaign Manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaign managers</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-56 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">All active</SelectItem>
              <SelectItem value="on_track">On track</SelectItem>
              <SelectItem value="needs_attention">Needs attention</SelectItem>
              <SelectItem value="at_risk">At risk</SelectItem>
              <SelectItem value="renewing_soon">Renewing in 60d</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile label="Active Campaigns" value={kpis.active} icon={Activity} />
          <KpiTile
            label="On Track"
            value={kpis.onTrack}
            icon={CheckCircle2}
            tone="green"
          />
          <KpiTile
            label="Needs Attention"
            value={kpis.attention}
            icon={AlertTriangle}
            tone="amber"
          />
          <KpiTile
            label="At Risk"
            value={kpis.atRisk}
            icon={AlertTriangle}
            tone="red"
          />
          <KpiTile
            label="Renewing ≤60d"
            value={kpis.renewingSoon}
            icon={CalendarClock}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Needs Attention Feed */}
          <Card className="card-surface p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Needs Attention</h2>
              <span className="text-xs text-muted-foreground">
                {needsAttentionFeed.length}
              </span>
            </div>
            {needsAttentionFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nothing flagged. Nice.
              </p>
            ) : (
              <ul className="space-y-2">
                {needsAttentionFeed.map((item, i) => (
                  <li
                    key={`${item.row.id}-${i}`}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <span
                      className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                        item.severity === "high" ? "bg-red-500" : "bg-amber-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {item.row.client_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.reason}
                      </div>
                      {item.row.campaign_manager && (
                        <div className="text-xs text-muted-foreground/60 mt-0.5">
                          {item.row.campaign_manager}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Client table */}
          <Card className="card-surface p-4 lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Campaigns</h2>
              <span className="text-xs text-muted-foreground">
                {filtered.length} shown · avg this-month fulfillment{" "}
                {kpis.avgFulfillment}%
              </span>
            </div>
            <div className="overflow-x-auto -mx-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Client</TableHead>
                    <TableHead>CM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">This mo.</TableHead>
                    <TableHead className="text-right">Overall</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                    <TableHead className="text-right pr-4">Renewal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        No campaigns match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => {
                      const dRenew = daysUntil(r.renewal_date);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="pl-4 font-medium">{r.client_name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {r.campaign_manager ?? "—"}
                          </TableCell>
                          <TableCell>
                            {statusBadge(r.campaign_success_status, r.status)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.current_month_cumulative_pct_fulfilled != null
                              ? `${Math.round(r.current_month_cumulative_pct_fulfilled)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.cumulative_pct_fulfilled != null
                              ? `${Math.round(r.cumulative_pct_fulfilled)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              {trendIcon(r.trend_vs_last_month)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-4 text-xs text-muted-foreground">
                            {r.renewal_date
                              ? dRenew !== null && dRenew >= 0 && dRenew <= 60
                                ? `in ${dRenew}d`
                                : new Date(r.renewal_date).toLocaleDateString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: any;
  tone?: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-500"
      : tone === "amber"
      ? "text-amber-500"
      : tone === "red"
      ? "text-red-500"
      : "text-foreground";
  return (
    <Card className="card-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
      </div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </Card>
  );
}

export default Overview;
