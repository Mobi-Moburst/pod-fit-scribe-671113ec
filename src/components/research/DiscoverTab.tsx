import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Plus, ExternalLink, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface Candidate {
  show_name: string;
  host_name?: string;
  description: string;
  apple_podcast_url?: string;
  cover_art_url?: string;
  itunes_id?: string;
  categories?: string[];
  est_listeners?: number;
  last_episode_date?: string;
  guest_cadence_score: number;
  guest_cadence_label: string;
  niche_fit_score: number;
  fit_rationale: string;
  niche_tag?: string;
}

interface Props {
  speakerId: string;
  orgId: string;
  shortlistedNames: Set<string>;
  onShortlisted: () => void;
}

export function DiscoverTab({ speakerId, orgId, shortlistedNames, onShortlisted }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  async function generate(append = false) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('research-suggest-podcasts', {
        body: { speaker_id: speakerId, num: 25 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const next: Candidate[] = data?.candidates || [];
      setCandidates(prev => {
        if (!append) return next;
        const seen = new Set(prev.map(p => p.show_name.toLowerCase()));
        return [...prev, ...next.filter(n => !seen.has(n.show_name.toLowerCase()))];
      });
    } catch (err: any) {
      toast({
        title: 'Failed to generate suggestions',
        description: err.message || 'Try again in a moment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function addToShortlist(c: Candidate) {
    setAdding(c.show_name);
    try {
      const { error } = await supabase.from('research_shortlists').insert({
        org_id: orgId,
        speaker_id: speakerId,
        show_name: c.show_name,
        show_url: c.apple_podcast_url,
        itunes_id: c.itunes_id,
        cover_art_url: c.cover_art_url,
        host_name: c.host_name,
        description: c.description,
        categories: c.categories || [],
        est_listeners: c.est_listeners,
        last_episode_date: c.last_episode_date,
        guest_cadence_score: c.guest_cadence_score,
        guest_cadence_label: c.guest_cadence_label,
        niche_fit_score: c.niche_fit_score,
        fit_rationale: c.fit_rationale,
        source: 'ai',
        status: 'new',
      });
      if (error) throw error;
      setAddedKeys(prev => new Set(prev).add(c.show_name.toLowerCase()));
      onShortlisted();
    } catch (err: any) {
      toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
    } finally {
      setAdding(null);
    }
  }

  const isAdded = (c: Candidate) =>
    addedKeys.has(c.show_name.toLowerCase()) || shortlistedNames.has(c.show_name.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Discover niche podcasts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-sourced shows that take guests, in the long-tail listener band.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {candidates.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => generate(true)} disabled={loading}>
              Generate 25 more
            </Button>
          )}
          <Button size="sm" onClick={() => generate(false)} disabled={loading}>
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sourcing…</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate 25 candidates</>
            )}
          </Button>
        </div>
      </div>

      {candidates.length === 0 && !loading && (
        <Card className="card-surface p-8 text-center">
          <Sparkles className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Click "Generate 25 candidates" to surface a fresh batch of niche, guest-friendly podcasts
            matched to this speaker's audience and talking points.
          </p>
        </Card>
      )}

      {loading && candidates.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {candidates.map((c) => {
          const added = isAdded(c);
          return (
            <Card key={c.show_name} className={cn('card-surface p-3', added && 'opacity-60')}>
              <div className="flex gap-3">
                {c.cover_art_url ? (
                  <img
                    src={c.cover_art_url}
                    alt={c.show_name}
                    className="h-14 w-14 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-md bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.show_name}</span>
                        {c.apple_podcast_url && (
                          <a
                            href={c.apple_podcast_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {c.host_name && (
                        <div className="text-xs text-muted-foreground mt-0.5">Hosted by {c.host_name}</div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                      <p className="text-xs text-foreground/80 mt-1.5 italic line-clamp-2">
                        Why: {c.fit_rationale}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-xs font-normal">
                          Fit {c.niche_fit_score}
                        </Badge>
                        {c.est_listeners ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            ~{c.est_listeners.toLocaleString()} listeners/ep
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                            Listeners unknown
                          </Badge>
                        )}
                        {c.niche_tag && (
                          <Badge variant="outline" className="text-xs font-normal">{c.niche_tag}</Badge>
                        )}
                        {c.last_episode_date && (
                          <span className="text-xs text-muted-foreground">
                            Last ep {new Date(c.last_episode_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={added ? 'ghost' : 'outline'}
                      disabled={added || adding === c.show_name}
                      onClick={() => addToShortlist(c)}
                      className="flex-shrink-0"
                    >
                      {added ? (
                        <><Check className="h-3.5 w-3.5 mr-1" /> Added</>
                      ) : adding === c.show_name ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><Plus className="h-3.5 w-3.5 mr-1" /> Shortlist</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
