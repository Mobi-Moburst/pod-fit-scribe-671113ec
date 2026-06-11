import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Activity, CalendarClock, TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Snapshot = {
  id: string;
  client_name: string;
  campaign_manager: string | null;
  status: string | null;
  campaign_success_status: string | null;
  cumulative_pct_fulfilled: number | null;
  current_month_cumulative_pct_fulfilled: number | null;
  goal_this_month: number | null;
  deliverables_completed_this_month: number | null;
  trend_vs_last_month: string | null;
  renewal_date: string | null;
  renewed: boolean | null;
  last_client_checkin: string | null;
  next_checkin_scheduled: string | null;
  eow_recap_sent: boolean | null;
  zz_complete: boolean | null;
  synced_at: string;
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date).getTime();
  return Math.round((d - Date.now()) / (1000 * 60 * 60 * 24));
}

function TrendBit({ t }: { t: string | null }) {
  if (!t) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const n = parseFloat(t);
  if (isNaN(n) || n === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (n > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

function StatusPill({ css, status }: { css: string | null; status: string | null }) {
  const s = (css ?? '').toLowerCase();
  const map: Record<string, string> = {
    green: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    yellow: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    red: 'bg-red-500/15 text-red-500 border-red-500/30',
  };
  const label = css || status || 'Unknown';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${map[s] ?? 'bg-[rgba(255,255,255,0.04)] text-muted-foreground border-[rgba(255,255,255,0.05)]'}`}>
      {label}
    </span>
  );
}

export function CampaignHealthCard({ companyId }: { companyId: string }) {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('ltv_snapshots')
        .select('id, client_name, campaign_manager, status, campaign_success_status, cumulative_pct_fulfilled, current_month_cumulative_pct_fulfilled, goal_this_month, deliverables_completed_this_month, trend_vs_last_month, renewal_date, renewed, last_client_checkin, next_checkin_scheduled, eow_recap_sent, zz_complete, synced_at')
        .eq('company_id', companyId)
        .order('client_name');
      if (!cancelled) {
        setSnaps((data ?? []) as Snapshot[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading) {
    return (
      <Card className="card-surface p-4">
        <div className="text-sm text-muted-foreground">Loading campaign health…</div>
      </Card>
    );
  }

  if (snaps.length === 0) return null;

  const active = snaps.filter(s => s.zz_complete !== true);
  if (active.length === 0) {
    return (
      <Card className="card-surface p-4">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">Campaign Health</span>
          <span className="text-muted-foreground">— marked complete in LTV</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Campaign Health</h3>
          <span className="text-xs text-muted-foreground">· LTV</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          synced {new Date(active[0].synced_at).toLocaleDateString()}
        </span>
      </div>

      {active.map((s) => {
        const dRenew = daysUntil(s.renewal_date);
        const dCheck = daysUntil(s.last_client_checkin);
        const renewSoon = dRenew !== null && dRenew >= 0 && dRenew <= 60;
        const staleCheckin = dCheck !== null && dCheck <= -21;
        return (
          <div key={s.id} className="border-t border-[rgba(255,255,255,0.05)] pt-3 first:border-t-0 first:pt-0 space-y-2">
            {active.length > 1 && (
              <div className="text-xs font-medium text-muted-foreground">{s.client_name}</div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill css={s.campaign_success_status} status={s.status} />
              {s.campaign_manager && (
                <span className="text-xs text-muted-foreground">{s.campaign_manager}</span>
              )}
              <span className="flex-1" />
              <TrendBit t={s.trend_vs_last_month} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric
                label="This month"
                value={s.current_month_cumulative_pct_fulfilled != null ? `${Math.round(s.current_month_cumulative_pct_fulfilled)}%` : '—'}
                hint={
                  s.deliverables_completed_this_month != null && s.goal_this_month != null
                    ? `${s.deliverables_completed_this_month} / ${s.goal_this_month}`
                    : undefined
                }
              />
              <Metric
                label="Overall"
                value={s.cumulative_pct_fulfilled != null ? `${Math.round(s.cumulative_pct_fulfilled)}%` : '—'}
              />
              <Metric
                label="Renewal"
                value={
                  s.renewal_date
                    ? renewSoon
                      ? `in ${dRenew}d`
                      : new Date(s.renewal_date).toLocaleDateString()
                    : '—'
                }
                tone={renewSoon && !s.renewed ? 'amber' : undefined}
                icon={renewSoon && !s.renewed ? CalendarClock : undefined}
              />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {s.last_client_checkin && (
                <span className={staleCheckin ? 'text-amber-500' : ''}>
                  Last check-in {new Date(s.last_client_checkin).toLocaleDateString()}
                  {staleCheckin && (
                    <AlertTriangle className="inline h-3 w-3 ml-1" />
                  )}
                </span>
              )}
              {s.next_checkin_scheduled && (
                <span>Next {new Date(s.next_checkin_scheduled).toLocaleDateString()}</span>
              )}
              {s.eow_recap_sent === false && (
                <span className="text-amber-500">EOW recap not sent</span>
              )}
              {s.renewed && <span className="text-emerald-500">Renewed</span>}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function Metric({
  label, value, hint, tone, icon: Icon,
}: { label: string; value: string; hint?: string; tone?: 'amber'; icon?: any }) {
  return (
    <div className="rounded-md border border-[rgba(255,255,255,0.05)] bg-background/30 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums ${tone === 'amber' ? 'text-amber-500' : ''}`}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
