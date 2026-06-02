import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  CalendarDays,
  RefreshCw,
  Mic,
  UserPlus,
  UserMinus,
  Users,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink } from "lucide-react";

type Booking = {
  id: string;
  campaign_manager: string | null;
  client_name: string | null;
  podcast_name: string | null;
  podcast_url: string | null;
  host_name: string | null;
  activity_type: string | null;
  date_secured: string | null;
  industry: string | null;
  company_id: string | null;
};

type LtvLite = {
  client_name: string;
  campaign_manager: string | null;
  goal_this_month: number | null;
  deliverables_completed_this_month: number | null;
  offboarding: boolean | null;
  zz_complete: boolean | null;
  renewal_date: string | null;
  renewed: boolean | null;
  current_month_cumulative_pct_fulfilled: number | null;
  synced_at: string;
};

interface PulseViewProps {
  cmFilter: string;
}

// Treat "Podcast Recording" (and minor variants) as a booking
const BOOKING_ACTIVITIES = new Set([
  "podcast recording",
  "podcast recording ",
  "recording",
]);
const isBooking = (b: Booking) =>
  BOOKING_ACTIVITIES.has((b.activity_type ?? "").toLowerCase().trim());

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}
function inRange(date: string | null, from: Date, to?: Date) {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  if (d < from) return false;
  if (to && d > to) return false;
  return true;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function normPodcast(name: string | null) {
  return (name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function PulseView({ cmFilter }: PulseViewProps) {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ltv, setLtv] = useState<LtvLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    const [b, l] = await Promise.all([
      supabase
        .from("momentum_bookings")
        .select(
          "id, campaign_manager, client_name, podcast_name, podcast_url, host_name, activity_type, date_secured, industry, company_id"
        )
        .order("date_secured", { ascending: false })
        .limit(5000),
      supabase
        .from("ltv_snapshots")
        .select(
          "client_name, campaign_manager, goal_this_month, deliverables_completed_this_month, offboarding, zz_complete, renewal_date, renewed, current_month_cumulative_pct_fulfilled, synced_at"
        ),
    ]);
    if (b.error) toast({ title: "Failed to load bookings", description: b.error.message, variant: "destructive" });
    setBookings((b.data ?? []) as Booking[]);
    setLtv((l.data ?? []) as LtvLite[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function sync() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-momentum-bookings");
    setSyncing(false);
    if (error) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Momentum synced",
      description: `${(data as any)?.upserted ?? 0} bookings · ${(data as any)?.matched_to_companies ?? 0} matched`,
    });
    load();
  }

  const filteredBookings = useMemo(() => {
    let rows = bookings.filter(isBooking);
    if (cmFilter !== "all") rows = rows.filter((b) => b.campaign_manager === cmFilter);
    return rows;
  }, [bookings, cmFilter]);

  const filteredLtv = useMemo(() => {
    let rows = ltv.filter((r) => r.zz_complete !== true);
    if (cmFilter !== "all") rows = rows.filter((r) => r.campaign_manager === cmFilter);
    return rows;
  }, [ltv, cmFilter]);

  const monthStart = startOfMonth();
  const yearStart = startOfYear();
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

  // KPI strip
  const bookingsThisMonth = filteredBookings.filter((b) => inRange(b.date_secured, monthStart)).length;
  const bookingsYTD = filteredBookings.filter((b) => inRange(b.date_secured, yearStart)).length;

  // New clients this month: client_name whose earliest date_secured is in this month
  const firstSecured = new Map<string, Date>();
  for (const b of filteredBookings) {
    if (!b.client_name || !b.date_secured) continue;
    const d = new Date(b.date_secured);
    if (isNaN(d.getTime())) continue;
    const cur = firstSecured.get(b.client_name);
    if (!cur || d < cur) firstSecured.set(b.client_name, d);
  }
  const newClientsThisMonth = Array.from(firstSecured.values()).filter((d) => d >= monthStart).length;

  const offboardingThisMonth = filteredLtv.filter((r) => {
    if (r.offboarding === true) return true;
    if (!r.renewal_date) return false;
    const d = new Date(r.renewal_date);
    return d >= monthStart && d <= monthEnd && r.renewed !== true;
  }).length;

  const activeSMEs = filteredLtv.length;
  const avgFulfillment =
    activeSMEs === 0
      ? 0
      : Math.round(
          filteredLtv.reduce(
            (s, r) => s + (r.current_month_cumulative_pct_fulfilled ?? 0),
            0
          ) / activeSMEs
        );

  // CM leaderboard
  const cmAgg = useMemo(() => {
    const map = new Map<
      string,
      { cm: string; thisMonth: number; ytd: number; goal: number }
    >();
    // bookings
    for (const b of filteredBookings) {
      const cm = b.campaign_manager ?? "Unassigned";
      if (!map.has(cm)) map.set(cm, { cm, thisMonth: 0, ytd: 0, goal: 0 });
      const row = map.get(cm)!;
      if (inRange(b.date_secured, monthStart)) row.thisMonth++;
      if (inRange(b.date_secured, yearStart)) row.ytd++;
    }
    // goals
    for (const r of filteredLtv) {
      const cm = r.campaign_manager ?? "Unassigned";
      if (!map.has(cm)) map.set(cm, { cm, thisMonth: 0, ytd: 0, goal: 0 });
      map.get(cm)!.goal += r.goal_this_month ?? 0;
    }
    return Array.from(map.values()).sort((a, b) => b.thisMonth - a.thisMonth);
  }, [filteredBookings, filteredLtv]);

  // Industry breakdown (YTD)
  const industryAgg = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of filteredBookings.filter((b) => inRange(b.date_secured, yearStart))) {
      const k = b.industry ?? "Unknown";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredBookings]);

  // Last 5 per top industry
  const lastByIndustry = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filteredBookings) {
      const k = b.industry ?? "Unknown";
      if (!map.has(k)) map.set(k, []);
      const arr = map.get(k)!;
      if (arr.length < 5) arr.push(b);
    }
    return map;
  }, [filteredBookings]);

  // Last 10 bookings overall
  const last10 = filteredBookings.slice(0, 10);

  // Top podcasts all-time
  const topPodcasts = useMemo(() => {
    const map = new Map<string, { name: string; count: number; url: string | null }>();
    for (const b of filteredBookings) {
      const key = normPodcast(b.podcast_name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { name: b.podcast_name!, count: 0, url: b.podcast_url });
      map.get(key)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredBookings]);

  // Per-client bookings
  const perClient = useMemo(() => {
    const map = new Map<
      string,
      { client: string; thisMonth: number; ytd: number; last: string | null; cm: string | null }
    >();
    for (const b of filteredBookings) {
      const k = b.client_name ?? "Unassigned";
      if (!map.has(k))
        map.set(k, { client: k, thisMonth: 0, ytd: 0, last: null, cm: b.campaign_manager });
      const row = map.get(k)!;
      if (inRange(b.date_secured, monthStart)) row.thisMonth++;
      if (inRange(b.date_secured, yearStart)) row.ytd++;
      if (b.date_secured && (!row.last || b.date_secured > row.last)) row.last = b.date_secured;
    }
    return Array.from(map.values()).sort((a, b) => b.ytd - a.ytd);
  }, [filteredBookings]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Momentum"}
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile label="Bookings this month" value={bookingsThisMonth} icon={Mic} />
        <KpiTile label="Bookings YTD" value={bookingsYTD} icon={CalendarDays} />
        <KpiTile label="New clients this mo." value={newClientsThisMonth} icon={UserPlus} tone="green" />
        <KpiTile label="Offboarding this mo." value={offboardingThisMonth} icon={UserMinus} tone="amber" />
        <KpiTile label="Active SMEs" value={activeSMEs} icon={Users} />
        <KpiTile label="Avg fulfillment" value={`${avgFulfillment}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CM leaderboard */}
        <Card className="card-surface p-4">
          <h2 className="text-sm font-semibold mb-3">CM Leaderboard</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : cmAgg.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data yet — sync Momentum.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Manager</TableHead>
                  <TableHead className="text-right">This mo.</TableHead>
                  <TableHead className="text-right">Goal</TableHead>
                  <TableHead className="text-right">% to goal</TableHead>
                  <TableHead className="text-right">YTD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cmAgg.map((r) => {
                  const pct = r.goal > 0 ? Math.round((r.thisMonth / r.goal) * 100) : null;
                  return (
                    <TableRow key={r.cm}>
                      <TableCell className="font-medium">{r.cm}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.thisMonth}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.goal || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct === null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              pct >= 100
                                ? "text-emerald-500"
                                : pct >= 70
                                ? "text-amber-500"
                                : "text-red-500"
                            }
                          >
                            {pct}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.ytd}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Industry breakdown */}
        <Card className="card-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Top industries (YTD)</h2>
          {industryAgg.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No bookings yet this year.</p>
          ) : (
            <div className="space-y-3">
              {industryAgg.map((r) => {
                const max = industryAgg[0].count || 1;
                const last5 = lastByIndustry.get(r.industry) ?? [];
                return (
                  <div key={r.industry} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.industry}</span>
                      <span className="text-muted-foreground tabular-nums">{r.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(r.count / max) * 100}%` }}
                      />
                    </div>
                    {last5.length > 0 && (
                      <div className="text-xs text-muted-foreground pl-1 pt-0.5">
                        Last 5:{" "}
                        {last5.map((b, i) => (
                          <span key={b.id}>
                            {i > 0 && " · "}
                            <span title={`${b.client_name} · ${fmtDate(b.date_secured)}`}>
                              {b.podcast_name}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Last 10 bookings */}
        <Card className="card-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Last 10 bookings</h2>
          {last10.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No bookings yet.</p>
          ) : (
            <ul className="space-y-2">
              {last10.map((b) => (
                <li key={b.id} className="flex items-start gap-2 text-sm">
                  <Activity className="h-3 w-3 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-1">
                      {b.podcast_url ? (
                        <a
                          href={b.podcast_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline truncate"
                        >
                          {b.podcast_name}
                        </a>
                      ) : (
                        b.podcast_name
                      )}
                      {b.podcast_url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.client_name} · {b.campaign_manager ?? "—"} · {fmtDate(b.date_secured)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top podcasts all-time */}
        <Card className="card-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Most-booked podcasts (all time)</h2>
          {topPodcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data.</p>
          ) : (
            <ul className="space-y-1.5">
              {topPodcasts.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}.</span>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline truncate">
                        {p.name}
                      </a>
                    ) : (
                      <span className="truncate">{p.name}</span>
                    )}
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {p.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Per-client bookings */}
      <Card className="card-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Bookings per client</h2>
          <span className="text-xs text-muted-foreground">{perClient.length} clients</span>
        </div>
        <div className="max-h-[440px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>CM</TableHead>
                <TableHead className="text-right">This mo.</TableHead>
                <TableHead className="text-right">YTD</TableHead>
                <TableHead className="text-right">Last booking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perClient.map((r) => (
                <TableRow key={r.client}>
                  <TableCell className="font-medium">{r.client}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.cm ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.thisMonth}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.ytd}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {fmtDate(r.last)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
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
