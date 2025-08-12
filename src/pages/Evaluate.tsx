
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { callAnalyze, callScrape, AnalyzeResult } from '@/utils/api';
import { sampleUrls } from '@/data/sampleUrls';
import { ResultsPanel } from '@/components/evaluate/ResultsPanel';
import type { MinimalClient } from '@/types/clients';
import { getClients } from '@/data/clientStore';

const Evaluate = () => {
  useEffect(() => { document.title = 'Evaluate — Podcast Fit Rater'; }, []);
  const { toast } = useToast();

  const [url, setUrl] = useState('');
  const [paste, setPaste] = useState('');
  const [clients, setClients] = useState<MinimalClient[]>(() => getClients());
  const [clientId, setClientId] = useState(() => (getClients()[0]?.id ?? ''));
  const client = useMemo(() => clients.find(c => c.id === clientId)!, [clients, clientId]);

  useEffect(() => {
    const reload = () => setClients(getClients());
    window.addEventListener('pfr_clients_updated', reload);
    return () => window.removeEventListener('pfr_clients_updated', reload);
  }, []);

  const [loading, setLoading] = useState(false);
const [result, setResult] = useState<(AnalyzeResult & { show_title?: string }) | null>(null);
const [showNotesOpen, setShowNotesOpen] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true); setResult(null);
    try {
      let notes = paste.trim();
      let title: string | undefined;
      const isAllowedPodcastUrl = (u: string) => /^(https?:\/\/)?(podcasts\.apple\.com|open\.spotify\.com)\//i.test(u);
      if (!notes) {
        if (!url) {
          toast({ title: 'Need notes', description: 'Enter a URL or paste show notes.', variant: 'destructive' });
          return;
        }
        if (!isAllowedPodcastUrl(url)) {
          toast({ title: 'Unsupported URL', description: 'Please use an Apple Podcasts or Spotify URL.', variant: 'destructive' });
          return;
        }
        const s = await callScrape(url);
        if (!s?.success || !s?.show_notes) {
          toast({ title: 'Couldn’t fetch show notes', description: 'Paste the notes manually and try again.' , variant: 'destructive'});
          return;
        }
        notes = s.show_notes as string;
        title = s.title;
        // Warn if the scraped content looks like bot-protection or a captcha page
        if (/(captcha|are you a robot|verify you(?:'|’)re a human|access denied|cloudflare|just a moment|attention required)/i.test(notes)) {
          toast({ title: 'Site blocked scraping', description: 'Try pasting notes manually or use Apple/Spotify/ListenNotes.', variant: 'default' });
        }
      }

      if (!client) {
        toast({ title: 'Select a client', description: 'Choose a client before analyzing.', variant: 'destructive' });
        return;
      }

      const resp = await callAnalyze({ client, show_notes: notes });
      if (!resp.success || !resp.data) {
        const rawStr = resp.raw ? String(resp.raw) : '';
        const snippet = rawStr ? rawStr.slice(0, 200) + (rawStr.length > 200 ? '…' : '') : '';
        const desc = resp.error ? `${resp.error}${snippet ? ' — ' + snippet : ''}` : 'Add your OpenAI key in Supabase Edge Function secrets.';
        toast({ title: 'Analysis failed', description: desc, variant: 'destructive' });
        return;
      }
      setResult({ ...resp.data, show_title: title });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Unexpected error. Try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result) return;
    const key = 'pfr_history';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([{ date: Date.now(), clientId, url, ...result }, ...prev].slice(0, 200)));
    window.dispatchEvent(new Event('pfr_history_updated'));
    toast({ title: 'Saved', description: 'Added to History.' });
  };

  const handleExportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'podcast-fit-result.json';
    a.click();
  };

  const handleCopySummary = async () => {
    if (!result) return;
    const text = result.summary_text || (() => {
      const verdictWord = result.verdict === 'recommend' ? 'Fit' : result.verdict === 'consider' ? 'Consider' : 'Not a fit';
      const clientName = (client?.name || 'the client').trim();
      const showName = (result.show_title || 'this show').trim();
      const audiences = (client?.target_audiences || []).slice(0, 2).join(' and ') || 'the target audience';
      const themes = (result.why_fit_structured || []).slice(0, 2).map(i => i.claim).join('; ') || 'recurring themes relevant to the campaign';
      const align = 'The format and tone support goals around education and authority without feeling sales-forward.';
      const gap = (result.why_not_fit_structured || [])[0];
      const gapsText = gap ? `${gap.severity === 'Critical' ? 'critical' : 'minor'} gap: ${gap.claim.toLowerCase()}` : 'no material gaps noted';
      const risk = (result.risk_flags_structured || [])[0]?.flag || '';
      const risksText = risk ? `Risks/constraints: ${risk.toLowerCase()}.` : '';
      const next = result.verdict === 'recommend'
        ? 'Next step: pitch a specific topic angle tailored to the show.'
        : result.verdict === 'consider'
          ? 'Next step: proceed if ICP and topic are confirmed by the host.'
          : 'Next step: suggest an adjacent show type with stronger audience alignment.';
      return `Verdict: ${verdictWord} for ${clientName} on ${showName}. Audience: ${audiences} and why that matters to the campaign. Content focus: ${themes} mapped to the client’s talking points. Why it aligns: ${align} Gaps to note: ${gapsText}. ${risksText} Next step: ${next}`;
    })();
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Summary copied to clipboard.' });
  };

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="p-4 card-surface md:col-span-2">
            <div className="grid gap-3">
              <Label htmlFor="url">Podcast URL</Label>
              <Input id="url" placeholder="Apple Podcasts or Spotify URL" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAnalyze(); }} />
<Collapsible open={showNotesOpen} onOpenChange={setShowNotesOpen}>
  <CollapsibleTrigger asChild>
    <Button type="button" variant="outline" className="mt-2">
      Optional: Paste show notes (fallback)
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="mt-2 space-y-2">
    <Label htmlFor="paste" className="sr-only">Optional: Paste show notes (fallback)</Label>
    <Textarea id="paste" rows={6} placeholder="Paste raw show notes if fetching fails" value={paste} onChange={(e) => setPaste(e.target.value)} />
  </CollapsibleContent>
</Collapsible>
            </div>
          </Card>
          <Card className="p-4 card-surface">
            <div className="grid gap-3">
              <Label htmlFor="client">Client</Label>
              <select id="client" className="h-10 rounded-md border bg-background px-3" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <div className="text-xs text-muted-foreground">Seeded from saved Clients. Manage in Clients tab.</div>
              <div className="flex gap-2 mt-2">
                <Button variant="hero" className="flex-1" onClick={handleAnalyze}>Analyze</Button>
                <Button variant="outline" type="button" onClick={() => {
                  const list = (sampleUrls as Record<string, string[]>)[clientId] || [];
                  setUrl(list[Math.floor(Math.random()*list.length)] || '');
                }}>Try Sample</Button>
              </div>
              <div className="text-xs text-muted-foreground">Cmd/Ctrl+Enter to Analyze</div>
            </div>
          </Card>
        </section>

        {loading && (
          <section className="mt-6 grid md:grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-xl bg-gradient-to-r from-card to-secondary/40 animate-shimmer bg-[length:200%_100%]" />
            <Skeleton className="h-24 rounded-xl bg-gradient-to-r from-card to-secondary/40 animate-shimmer bg-[length:200%_100%]" />
            <Skeleton className="h-24 rounded-xl bg-gradient-to-r from-card to-secondary/40 animate-shimmer bg-[length:200%_100%]" />
            <Skeleton className="h-48 rounded-xl bg-gradient-to-r from-card to-secondary/40 animate-shimmer bg-[length:200%_100%] md:col-span-3" />
          </section>
        )}

        {result && (
          <ResultsPanel
            result={result}
            onSave={handleSave}
            onCopySummary={handleCopySummary}
            onExportJson={handleExportJson}
          />
        )}
      </main>
    </div>
  );
};

export default Evaluate;
