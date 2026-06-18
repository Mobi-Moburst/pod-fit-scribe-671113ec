import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, Copy, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ShortlistRow } from './ShortlistTab';

interface Angle {
  id: string;
  headline: string;
  rationale: string;
}

interface Props {
  row: ShortlistRow;
  onClose: () => void;
}

export function AnglesPanel({ row, onClose }: Props) {
  const { toast } = useToast();
  const [angles, setAngles] = useState<Angle[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  async function load() {
    const { data, error } = await supabase
      .from('research_angles')
      .select('id, headline, rationale')
      .eq('shortlist_id', row.id)
      .order('created_at', { ascending: true });
    if (!error) setAngles((data || []) as Angle[]);
  }

  async function generate() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('research-suggest-angles', {
        body: { shortlist_id: row.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAngles((data?.angles || []) as Angle[]);
    } catch (err: any) {
      toast({ title: 'Failed to generate angles', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <Card className="card-surface h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 p-4 border-b border-[rgba(255,255,255,0.05)]">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{row.show_name}</div>
          {row.host_name && (
            <div className="text-xs text-muted-foreground truncate">Hosted by {row.host_name}</div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {angles.length === 0 && !loading ? (
          <div className="text-center py-8">
            <Sparkles className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
              Generate 4 distinct pitch angles tuned to this show's audience. Copy a hook, paste into your HubSpot template.
            </p>
            <Button size="sm" onClick={generate} disabled={loading}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Suggest angles
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Drafting angles…
          </div>
        ) : (
          <>
            {angles.map((a, i) => (
              <div key={a.id} className="rounded-lg border border-[rgba(255,255,255,0.05)] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => copy(a.headline, `${a.id}-h`)}
                    >
                      {copiedId === `${a.id}-h` ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Hook
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => copy(`${a.headline}\n\n${a.rationale}`, `${a.id}-f`)}
                    >
                      {copiedId === `${a.id}-f` ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Full
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-medium leading-snug">{a.headline}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{a.rationale}</p>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="w-full">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Regenerate angles
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
