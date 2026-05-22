import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalLink, MoreHorizontal, Trash2, Lightbulb, Bookmark, Mic, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export type ShortlistRow = {
  id: string;
  show_name: string;
  show_url: string | null;
  host_name: string | null;
  description: string | null;
  cover_art_url: string | null;
  niche_tag: string | null;
  niche_fit_score: number | null;
  est_listeners: number | null;
  last_episode_date: string | null;
  status: string;
  source: string;
};

interface Props {
  rows: ShortlistRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  new: { label: 'New', tone: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  'pitched-elsewhere': { label: 'Pitched', tone: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  booked: { label: 'Booked', tone: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  passed: { label: 'Passed', tone: 'bg-muted text-muted-foreground border-border' },
};

export function ShortlistTab({ rows, selectedId, onSelect, onChanged }: Props) {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const { error } = await supabase
      .from('research_shortlists')
      .update({ status })
      .eq('id', id);
    setBusyId(null);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      onChanged();
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    const { error } = await supabase.from('research_shortlists').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      onChanged();
    }
  }

  if (rows.length === 0) {
    return (
      <Card className="card-surface p-8 text-center">
        <Bookmark className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          No shortlisted podcasts yet. Use the Discover tab to surface niche candidates and add them here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const status = STATUS_LABELS[r.status] || STATUS_LABELS.new;
        const selected = selectedId === r.id;
        return (
          <Card
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={cn(
              'card-surface p-3 cursor-pointer transition-colors hover:bg-muted/30',
              selected && 'border-primary/40 bg-muted/30',
              r.status === 'passed' && 'opacity-60'
            )}
          >
            <div className="flex gap-3">
              {r.cover_art_url ? (
                <img src={r.cover_art_url} alt={r.show_name} className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-md bg-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{r.show_name}</span>
                      {r.show_url && (
                        <a
                          href={r.show_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <Badge variant="outline" className={cn('text-xs font-normal', status.tone)}>
                        {status.label}
                      </Badge>
                    </div>
                    {r.host_name && (
                      <div className="text-xs text-muted-foreground mt-0.5">Hosted by {r.host_name}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {typeof r.niche_fit_score === 'number' && (
                        <Badge variant="secondary" className="text-xs font-normal">Fit {r.niche_fit_score}</Badge>
                      )}
                      {r.est_listeners ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          ~{r.est_listeners.toLocaleString()} listeners/ep
                        </Badge>
                      ) : null}
                      {r.niche_tag && <Badge variant="outline" className="text-xs font-normal">{r.niche_tag}</Badge>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" disabled={busyId === r.id} className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => onSelect(r.id)}>
                        <Lightbulb className="h-3.5 w-3.5 mr-2" /> Suggest angles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(r.id, 'pitched-elsewhere')}>
                        <Mic className="h-3.5 w-3.5 mr-2" /> Mark as pitched
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(r.id, 'booked')}>
                        <Bookmark className="h-3.5 w-3.5 mr-2" /> Mark as booked
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(r.id, 'passed')}>
                        <X className="h-3.5 w-3.5 mr-2" /> Pass
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => remove(r.id)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
