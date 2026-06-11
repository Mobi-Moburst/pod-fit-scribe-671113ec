import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Activity, Send, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CompanyKpiStripProps {
  companyId: string;
}

type WindowKey = "quarter" | "90d" | "all";

interface Kpis {
  bookings: number | null;
  published: number | null;
  upcoming: number | null;
  est_reach: number | null;
  computed_at?: string;
  cached?: boolean;
}

const EMPTY: Kpis = { bookings: null, published: null, upcoming: null, est_reach: null };
const REFRESH_INTERVAL_MS = 60_000;

function formatCount(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

const WINDOW_OPTIONS: { key: WindowKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "90d", label: "90d" },
  { key: "quarter", label: "Quarter" },
];

export function CompanyKpiStrip({ companyId }: CompanyKpiStripProps) {
  const [window, setWindow] = useState<WindowKey>("all");
  const [kpis, setKpis] = useState<Kpis>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lastCompanyId = useRef<string>(companyId);

  const fetchKpis = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!companyId) return;
      const isInitial = !opts.force && kpis.bookings === null;
      if (opts.force) setRefreshing(true);
      else if (isInitial) setLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke("compute-company-kpis", {
          body: { company_id: companyId, window, force: !!opts.force },
        });
        if (error) throw error;
        setKpis({
          bookings: data?.bookings ?? null,
          published: data?.published ?? null,
          upcoming: data?.upcoming ?? null,
          est_reach: data?.est_reach ?? null,
          computed_at: data?.computed_at,
          cached: data?.cached,
        });
      } catch (err) {
        console.error("compute-company-kpis failed:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, window],
  );

  // Reset on company change, then load
  useEffect(() => {
    if (lastCompanyId.current !== companyId) {
      lastCompanyId.current = companyId;
      setKpis(EMPTY);
    }
    fetchKpis();
  }, [companyId, window, fetchKpis]);

  // Auto-refresh on interval + on tab focus, for a real-time feel
  useEffect(() => {
    const interval = setInterval(() => fetchKpis({ force: true }), REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchKpis({ force: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchKpis]);

  const items = [
    { label: "Bookings", value: kpis.bookings, icon: Calendar, tint: "from-sky-500/20 to-sky-500/0", iconClass: "text-sky-400" },
    { label: "Est. Reach", value: kpis.est_reach, icon: Activity, tint: "from-cyan-500/20 to-cyan-500/0", iconClass: "text-cyan-400" },
    { label: "Published", value: kpis.published, icon: Send, tint: "from-violet-500/20 to-violet-500/0", iconClass: "text-violet-400" },
    { label: "Upcoming", value: kpis.upcoming, icon: Clock, tint: "from-amber-500/20 to-amber-500/0", iconClass: "text-amber-400" },
  ];

  return (
    <div className="px-4 pt-3 pb-2">
      {/* Window selector + refresh */}
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-0.5 rounded-md border border-[rgba(255,255,255,0.05)] bg-muted/30 p-0.5">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setWindow(opt.key)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide transition-colors",
                window === opt.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchKpis({ force: true })}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-[rgba(255,255,255,0.06)]"
          title={
            kpis.computed_at
              ? `Updated ${new Date(kpis.computed_at).toLocaleTimeString()}${kpis.cached ? " (cached)" : ""}`
              : "Refresh"
          }
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {items.map(({ label, value, icon: Icon, tint, iconClass }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-lg border border-[rgba(255,255,255,0.05)] bg-gradient-to-b ${tint} bg-card/40 px-2.5 py-2`}
          >
            <Icon className={`h-3.5 w-3.5 ${iconClass} mb-1`} />
            <div className="text-base font-semibold tabular-nums leading-none tracking-tight">
              {loading && value === null ? (
                <span className="inline-block h-3 w-6 rounded bg-muted/60 animate-pulse" />
              ) : (
                formatCount(value)
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
