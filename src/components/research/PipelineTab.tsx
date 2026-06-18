import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ExternalLink, Settings as SettingsIcon, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchSpeakerTickets, hubspotTicketUrl, type HubspotStageGroup } from '@/lib/hubspot';
import { cn } from '@/lib/utils';

interface Props {
  speakerName: string;
  onTicketsLoaded?: (ticketSubjects: string[]) => void;
}

export function PipelineTab({ speakerName, onTicketsLoaded }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stages, setStages] = useState<HubspotStageGroup[]>([]);
  const [portalId, setPortalId] = useState<string | null>(null);
  const [pipelineLabel, setPipelineLabel] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const res = await fetchSpeakerTickets(speakerName);
    if (!res.ok) {
      setErrorCode(res.code);
      setErrorMessage(res.error);
      setStages([]);
      onTicketsLoaded?.([]);
    } else {
      setErrorCode(undefined);
      setErrorMessage(undefined);
      setStages(res.stages || []);
      setPortalId(res.portal_id || null);
      setPipelineLabel(res.pipeline_label || null);
      setTotal(res.total || 0);
      onTicketsLoaded?.((res.tickets || []).map((t) => t.subject));
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerName]);

  const nonEmptyStages = useMemo(() => stages.filter((s) => s.tickets.length > 0), [stages]);

  if (loading) {
    return (
      <Card className="card-surface p-8 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading HubSpot pipeline…
      </Card>
    );
  }

  if (errorCode === 'not_connected') {
    return (
      <Card className="card-surface p-8 text-center">
        <Plug className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium mb-1">HubSpot isn't connected yet</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
          Connect HubSpot in workspace settings, then choose the Agent Master Pipeline.
        </p>
        <Button asChild size="sm">
          <Link to="/settings"><SettingsIcon className="h-3.5 w-3.5 mr-1.5" /> Open Settings</Link>
        </Button>
      </Card>
    );
  }

  if (errorCode === 'not_configured') {
    return (
      <Card className="card-surface p-8 text-center">
        <SettingsIcon className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium mb-1">Pick the HubSpot pipeline</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
          We need to know which pipeline to read. Choose your Agent Master Pipeline in Settings.
        </p>
        <Button asChild size="sm">
          <Link to="/settings"><SettingsIcon className="h-3.5 w-3.5 mr-1.5" /> Configure</Link>
        </Button>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card className="card-surface p-6 text-center text-sm text-destructive">
        {errorMessage}
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => load(true)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {pipelineLabel ? <span className="font-medium text-foreground">{pipelineLabel}</span> : 'HubSpot pipeline'}
          {' · '}
          {total} ticket{total === 1 ? '' : 's'} matched <code className="text-[10px] px-1 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">kc_client = {speakerName}</code>
        </div>
        <Button size="sm" variant="ghost" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {total === 0 ? (
        <Card className="card-surface p-8 text-center text-sm text-muted-foreground">
          No HubSpot tickets yet for <span className="font-medium text-foreground">{speakerName}</span>.
          <br />
          Shortlist shows and use “Send to HubSpot” to create the first ticket.
        </Card>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1 pb-2">
          <div className="flex gap-3 min-w-max">
            {(nonEmptyStages.length > 0 ? nonEmptyStages : stages).map((stage) => (
              <div key={stage.stage_id} className="w-[260px] flex-shrink-0">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stage.label}</span>
                  <Badge variant="secondary" className="text-xs font-normal">{stage.tickets.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stage.tickets.length === 0 ? (
                    <div className="text-xs text-muted-foreground/60 italic px-1">—</div>
                  ) : stage.tickets.map((t) => (
                    <Card key={t.id} className="card-surface p-3 hover:bg-[rgba(255,255,255,0.06)] transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium leading-snug min-w-0 flex-1 break-words">{t.subject}</div>
                        <a
                          href={hubspotTicketUrl(portalId, t.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Open in HubSpot"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {t.owner && (
                          <Badge variant="outline" className="text-xs font-normal">{t.owner.name}</Badge>
                        )}
                        {t.priority && (
                          <Badge variant="outline" className={cn(
                            'text-xs font-normal',
                            t.priority === 'HIGH' && 'border-amber-500/40 text-amber-500',
                            t.priority === 'URGENT' && 'border-rose-500/40 text-rose-500'
                          )}>
                            {t.priority.toLowerCase()}
                          </Badge>
                        )}
                      </div>
                      {t.last_modified && (
                        <div className="text-[11px] text-muted-foreground mt-2">
                          Updated {new Date(t.last_modified).toLocaleDateString()}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
