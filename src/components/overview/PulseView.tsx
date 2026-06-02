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
  AlertTriangle,
  Target,
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
  actual_bookings_to_date: number | null;
  total_planned_bookings_by_eom: number | null;
  synced_at: string;
};

type SpeakerLite = {
  id: string;
  name: string;
  company_id: string;
  archived_at: string | null;
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
function parseLocalDate(date: string): Date {
  // YYYY-MM-DD strings parse as UTC midnight by default, which shifts them a
  // day in negative-offset timezones. Parse as local-midnight instead.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }
  return new Date(date);
}
function inRange(date: string | null, from: Date, to?: Date) {
  if (!date) return false;
  const d = parseLocalDate(date);
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

function normName(s: string | null) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pctTone(pct: number | null) {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 100) return "text-emerald-500";
  if (pct >= 70) return "text-amber-500";
  return "text-red-500";
}

export function PulseView({ cmFilter }: PulseViewProps) {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ltv, setLtv] = useState<LtvLite[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  

  async function load() {
    setLoading(true);
    const [b, l, s] = await Promise.all([
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
          "client_name, campaign_manager, goal_this_month, deliverables_completed_this_month, offboarding, zz_complete, renewal_date, renewed, current_month_cumulative_pct_fulfilled, actual_bookings_to_date, total_planned_bookings_by_eom, synced_at"
        ),
      supabase
        .from("speakers")
        .select("id, name, company_id, archived_at")
        .is("archived_at", null),
    ]);
    if (b.error) toast({ title: "Failed to load bookings", description: b.error.message, variant: "destructive" });
    setBookings((b.data ?? []) as Booking[]);
    setLtv((l.data ?? []) as LtvLite[]);
    setSpeakers((s.data ?? []) as SpeakerLite[]);
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
  const totalMonthlyGoal = filteredLtv.reduce((s, r) => s + (r.goal_this_month ?? 0), 0);
  const monthlyVsGoalPct = totalMonthlyGoal > 0 ? Math.round((bookingsThisMonth / totalMonthlyGoal) * 100) : null;

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

  // Clients leaving this month: name + end date list
  const leavingThisMonth = useMemo(() => {
    return filteredLtv
      .filter((r) => {
        if (r.offboarding === true) return true;
        if (!r.renewal_date) return false;
        const d = new Date(r.renewal_date);
        return d >= monthStart && d <= monthEnd && r.renewed !== true;
      })
      .map((r) => ({ client: r.client_name, end: r.renewal_date, cm: r.campaign_manager }))
      .sort((a, b) => (a.end ?? "").localeCompare(b.end ?? ""));
  }, [filteredLtv]);

  const activeSMEs = filteredLtv.length;

  // Backlog logic (per management):
  //   "Deliverables Goal this Month_KG >= 2 × Total Bookings Per Month"
  // i.e. goal_this_month already inflates with missed months, so when it
  // reaches 2× what's actually been booked this month, the client is behind
  // by an entire month of contracted deliverables.
  //   - Backlog (red):  day >= 15 AND goal >= 2 × completed_this_month
  //   - At risk (amber): day 8–14 AND same ratio (early warning)
  const backlogged = useMemo(() => {
    const dayOfMonth = new Date().getDate();
    return filteredLtv
      .filter((r) => r.offboarding !== true && r.zz_complete !== true)
      .map((r) => {
        const goal = Number(r.goal_this_month ?? 0);
        const completed = Number(r.deliverables_completed_this_month ?? 0);
        const planned = Number(r.total_planned_bookings_by_eom ?? 0);
        const actual = Number(r.actual_bookings_to_date ?? 0);
        const ratioHit = goal > 0 && goal >= 2 * completed;
        let status: "backlog" | "at-risk" | null = null;
        if (ratioHit) {
          if (dayOfMonth >= 15) status = "backlog";
          else if (dayOfMonth >= 8) status = "at-risk";
        }
        return {
          client: r.client_name,
          cm: r.campaign_manager,
          current: actual,
          total: planned,
          remaining: planned - actual,
          goal,
          completed,
          status,
        };
      })
      .filter((r) => r.status !== null)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "backlog" ? -1 : 1;
        // Bigger gap (goal − completed) first
        return (b.goal - b.completed) - (a.goal - a.completed);
      });
  }, [filteredLtv]);

  const backlogCount = backlogged.filter((r) => r.status === "backlog").length;
  const atRiskCount = backlogged.filter((r) => r.status === "at-risk").length;

  // CM leaderboard
  const cmAgg = useMemo(() => {
    const map = new Map<
      string,
      { cm: string; thisMonth: number; ytd: number; goal: number }
    >();
    for (const b of filteredBookings) {
      const cm = b.campaign_manager ?? "Unassigned";
      if (!map.has(cm)) map.set(cm, { cm, thisMonth: 0, ytd: 0, goal: 0 });
      const row = map.get(cm)!;
      if (inRange(b.date_secured, monthStart)) row.thisMonth++;
      if (inRange(b.date_secured, yearStart)) row.ytd++;
    }
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

  const last10 = filteredBookings.slice(0, 10);

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

  // Bookings per company THIS MONTH (grid)
  const companyMonthGrid = useMemo(() => {
    const ltvByName = new Map<string, LtvLite>();
    for (const r of filteredLtv) ltvByName.set(normName(r.client_name), r);
    const map = new Map<
      string,
      { client: string; count: number; goal: number; cm: string | null }
    >();
    for (const b of filteredBookings.filter((b) => inRange(b.date_secured, monthStart))) {
      const k = b.client_name ?? "Unassigned";
      if (!map.has(k)) {
        const ltvRow = ltvByName.get(normName(k));
        map.set(k, {
          client: k,
          count: 0,
          goal: ltvRow?.goal_this_month ?? 0,
          cm: b.campaign_manager ?? ltvRow?.campaign_manager ?? null,
        });
      }
      map.get(k)!.count++;
    }
    // Include LTV clients with goals but zero bookings this month so the gap is visible
    for (const r of filteredLtv) {
      if (r.offboarding === true || r.zz_complete === true) continue;
      if (!r.goal_this_month || r.goal_this_month <= 0) continue;
      if (!map.has(r.client_name)) {
        map.set(r.client_name, {
          client: r.client_name,
          count: 0,
          goal: r.goal_this_month,
          cm: r.campaign_manager,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.client.localeCompare(b.client)
    );
  }, [filteredBookings, filteredLtv]);

  // Bookings per speaker THIS MONTH (grid) — resolved via speakers table
  const speakerMonthGrid = useMemo(() => {
    const speakersByCompany = new Map<string, SpeakerLite[]>();
    for (const sp of speakers) {
      if (!speakersByCompany.has(sp.company_id)) speakersByCompany.set(sp.company_id, []);
      speakersByCompany.get(sp.company_id)!.push(sp);
    }
    const map = new Map<
      string,
      { key: string; label: string; subtitle: string; count: number }
    >();
    for (const b of filteredBookings.filter((b) => inRange(b.date_secured, monthStart))) {
      let label = "Unassigned";
      let subtitle = "";
      let key = "unassigned";
      if (b.company_id && speakersByCompany.has(b.company_id)) {
        const list = speakersByCompany.get(b.company_id)!;
        if (list.length === 1) {
          label = list[0].name;
          subtitle = b.client_name ?? "";
          key = `sp:${list[0].id}`;
        } else {
          label = `${b.client_name ?? "Company"} — multiple speakers`;
          subtitle = `${list.length} speakers`;
          key = `multi:${b.company_id}`;
        }
      } else {
        label = b.client_name ?? "Unassigned";
        subtitle = "No matched company";
        key = `un:${label}`;
      }
      if (!map.has(key)) map.set(key, { key, label, subtitle, count: 0 });
      map.get(key)!.count++;
    }
    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    );
  }, [filteredBookings, speakers]);

  // Per-client bookings (existing table)
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
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Momentum"}
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile label="Bookings this month" value={bookingsThisMonth} icon={Mic} />
        <KpiTile
          label="Monthly vs deliverable"
          value={`${bookingsThisMonth} / ${totalMonthlyGoal || "—"}${monthlyVsGoalPct !== null ? ` · ${monthlyVsGoalPct}%` : ""}`}
          icon={Target}
          tone={
            monthlyVsGoalPct === null
              ? undefined
              : monthlyVsGoalPct >= 100
              ? "green"
              : monthlyVsGoalPct >= 70
              ? "amber"
              : "red"
          }
        />
        <KpiTile label="Bookings YTD" value={bookingsYTD} icon={CalendarDays} />
        <KpiTile label="New clients this mo." value={newClientsThisMonth} icon={UserPlus} tone="green" />
        <KpiTile label="Leaving this mo." value={leavingThisMonth.length} icon={UserMinus} tone="amber" />
        <KpiTile label="Active SMEs" value={activeSMEs} icon={Users} />
      </div>

      {/* Backlogged clients */}
      <Card className="card-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Backlogged clients
          </h2>
          <span className="text-xs text-muted-foreground">
            Goal ≥ 2× bookings this month · {backlogCount} backlog · {atRiskCount} at risk
          </span>

        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : backlogged.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No backlogged clients — everyone on pace.
          </p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CM</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Total due</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Monthly goal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlogged.map((r) => (
                  <TableRow key={r.client}>
                    <TableCell className="font-medium">{r.client}</TableCell>
                    <TableCell>
                      {r.status === "backlog" ? (
                        <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
                          Backlog
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                          At risk
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.cm ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.current}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                    <TableCell className={`text-right tabular-nums ${r.status === "backlog" ? "text-red-500" : "text-amber-500"}`}>
                      {r.remaining}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.goal}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

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
                        {pct === null ? "—" : <span className={pctTone(pct)}>{pct}%</span>}
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

      {/* Bookings per company — this month */}
      <Card className="card-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Bookings per company — this month</h2>
          <span className="text-xs text-muted-foreground">{companyMonthGrid.length} clients</span>
        </div>
        {companyMonthGrid.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No bookings yet this month.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {companyMonthGrid.map((r) => {
              const pct = r.goal > 0 ? Math.round((r.count / r.goal) * 100) : null;
              return (
                <div
                  key={r.client}
                  className="border border-border rounded-md p-2.5 bg-card/50"
                >
                  <div className="text-sm font-medium truncate" title={r.client}>
                    {r.client}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.cm ?? "—"}</div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-lg font-semibold tabular-nums">
                      {r.count}
                      <span className="text-xs text-muted-foreground font-normal">
                        {" "}/ {r.goal || "—"}
                      </span>
                    </span>
                    {pct !== null && (
                      <span className={`text-xs tabular-nums ${pctTone(pct)}`}>{pct}%</span>
                    )}
                  </div>
                  <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, pct ?? (r.count > 0 ? 100 : 0))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Bookings per speaker — this month */}
      <Card className="card-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Bookings per speaker — this month</h2>
          <span className="text-xs text-muted-foreground">{speakerMonthGrid.length} entries</span>
        </div>
        {speakerMonthGrid.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No bookings yet this month.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {speakerMonthGrid.map((r) => (
              <div
                key={r.key}
                className="border border-border rounded-md p-2.5 bg-card/50"
              >
                <div className="text-sm font-medium truncate" title={r.label}>
                  {r.label}
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.subtitle || "—"}</div>
                <div className="mt-1.5 text-lg font-semibold tabular-nums">{r.count}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clients leaving this month */}
        <Card className="card-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <UserMinus className="h-3.5 w-3.5 text-amber-500" />
              Clients leaving this month
            </h2>
            <span className="text-xs text-muted-foreground">{leavingThisMonth.length}</span>
          </div>
          {leavingThisMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">None this month.</p>
          ) : (
            <ul className="space-y-1.5">
              {leavingThisMonth.map((r) => (
                <li
                  key={r.client}
                  className="flex items-center justify-between text-sm border-b border-border/50 last:border-0 pb-1.5 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.client}</div>
                    <div className="text-xs text-muted-foreground">{r.cm ?? "—"}</div>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtDate(r.end)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Per-client bookings */}
        <Card className="card-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Bookings per client (YTD)</h2>
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
