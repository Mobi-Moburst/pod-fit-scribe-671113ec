import { useEffect, useState } from "react";
import { Calendar, Activity, Send, Clock } from "lucide-react";
import { useAirtableConnection } from "@/hooks/use-airtable-connection";

interface CompanyKpiStripProps {
  companyId: string;
}

interface Kpis {
  bookings: number | null;
  estReach: number | null;
  published: number | null;
  upcoming: number | null;
}

const EMPTY: Kpis = { bookings: null, estReach: null, published: null, upcoming: null };

function formatCount(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function CompanyKpiStrip({ companyId }: CompanyKpiStripProps) {
  const { connection, hasConnection, syncData } = useAirtableConnection({ companyId });
  const [kpis, setKpis] = useState<Kpis>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setKpis(EMPTY);
    if (!hasConnection || !connection) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const now = new Date();
      const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      const rows = await syncData({
        dateRangeStart: start.toISOString().slice(0, 10),
        dateRangeEnd: end.toISOString().slice(0, 10),
      });
      if (cancelled || !rows) {
        setLoading(false);
        return;
      }
      const today = Date.now();
      let bookings = 0,
        published = 0,
        upcoming = 0;
      for (const r of rows) {
        if (r.date_booked) bookings++;
        if (r.date_published) published++;
        const sched = r.scheduled_date_time ? new Date(r.scheduled_date_time).getTime() : NaN;
        if (!r.date_published && !isNaN(sched) && sched > today) upcoming++;
      }
      setKpis({ bookings, estReach: null, published, upcoming });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasConnection, connection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = [
    { label: "Bookings", value: kpis.bookings, icon: Calendar, tint: "from-sky-500/20 to-sky-500/0", iconClass: "text-sky-400" },
    { label: "Est. Reach", value: kpis.estReach, icon: Activity, tint: "from-cyan-500/20 to-cyan-500/0", iconClass: "text-cyan-400" },
    { label: "Published", value: kpis.published, icon: Send, tint: "from-violet-500/20 to-violet-500/0", iconClass: "text-violet-400" },
    { label: "Upcoming", value: kpis.upcoming, icon: Clock, tint: "from-amber-500/20 to-amber-500/0", iconClass: "text-amber-400" },
  ];

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ label, value, icon: Icon, tint, iconClass }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-b ${tint} bg-card/40 px-2.5 py-2`}
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
      {!hasConnection && (
        <p className="text-[10px] text-muted-foreground/70 mt-2 text-center">
          Connect Airtable to populate live KPIs
        </p>
      )}
    </div>
  );
}
