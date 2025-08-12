
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

    const clean = (s: string) => (s || '')
      .replace(/[“”]/g, '')
      .replace(/^[\s\-•–—]+/, '')
      .trim()
      .replace(/[\s]*[.,;:!?]+$/, '');

    const verdictWord = result.verdict === 'recommend' ? 'Fit' : result.verdict === 'consider' ? 'Consider' : 'Not a fit';
    const clientName = (client?.name || 'the client').trim();
    const showName = (result.show_title || 'this show').trim();

    // Audience-first: prefer model-derived segments, fallback to client targets
    const inferredSegments = (result as any).audience_segments as string[] | undefined;
    const targetSegs = client?.target_audiences || [];
    const segs = (inferredSegments && inferredSegments.length ? inferredSegments : targetSegs).map(clean).filter(Boolean).slice(0, 2);
    const audiencePhrase = segs.length ? segs.join(' and ') : 'relevant decision makers';

    // Campaign themes / topics
    const pitchTopics = (result.recommended_talking_points || (result as any).talking_points_to_pitch || []).map(clean).filter(Boolean);
    const themeClaims = (result.why_fit_structured || []).map(i => clean(i.claim)).filter(Boolean);
    const topicItems = (themeClaims.length ? themeClaims : pitchTopics).slice(0, 2);
    const themes = topicItems.length === 2 ? `${topicItems[0]} and ${topicItems[1]}` : (topicItems[0] || 'practical themes that support the campaign');

    // Risks: include only material (Critical) if present
    const criticalRiskRaw = (result.risk_flags_structured || []).find(r => r.severity === 'Critical')?.flag || '';
    const criticalRisk = clean(criticalRiskRaw).toLowerCase();

    // Next step depends on verdict
    const pitchAngle = clean(pitchTopics[0] || topicItems[0] || '');
    let nextStep = '';
    if (result.verdict === 'recommend') {
      nextStep = pitchAngle ? `Pitch ${pitchAngle.toLowerCase()} tailored to the audience.` : 'Pitch a focused, actionable education angle.';
    } else if (result.verdict === 'consider') {
      nextStep = 'Confirm audience composition with the host, then proceed.';
    } else {
      nextStep = 'Suggest an adjacent show with stronger role alignment.';
    }

    // Compose paragraph (aim 110–160 words)
    const sentences: string[] = [];
    sentences.push(`${verdictWord} for ${clientName} on ${showName}.`);
    sentences.push(`This show reaches ${audiencePhrase}, and that matters because it directly serves the campaign goals by getting in front of likely buyers and influencers.`);
    sentences.push(`Conversations focus on ${themes}, creating room for education, authority building, and gentle pipeline warm-up aligned to a practical call to action.`);
    sentences.push(`Format and tone are supportive rather than decisive; the audience fit is the reason to move forward.`);
    if (criticalRisk) {
      sentences.push(`Watch for a material constraint: ${criticalRisk}.`);
    } else {
      sentences.push('No material blockers surfaced in the review.');
    }
    sentences.push(`${nextStep}`);

    const paragraphRaw = sentences.join(' ');
    const words = paragraphRaw.split(/\s+/).filter(Boolean);
    let paragraph = paragraphRaw;
    if (words.length < 110) {
      const extender = ' Expect strong resonance with the target segments and a clean path to value without forcing product talk.';
      paragraph = (paragraphRaw + extender).trim();
    } else if (words.length > 160) {
      paragraph = words.slice(0, 160).join(' ').replace(/[,;:]?$/, '.');
    }
    
    // Tidy punctuation and spacing to avoid stray commas/periods
    paragraph = paragraph
      .replace(/([,;:])\./g, '$1')
      .replace(/([.,;:!?])\s*([.,;:!?])/g, '$1 ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/([.,;:!?])([^\s])/g, '$1 $2')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Bullets: 3 concise lines (<= 12 words each)
    const limitWords = (s: string) => s.split(/\s+/).slice(0, 12).join(' ').trim();
    const bullet1 = limitWords(`Audience: ${audiencePhrase}`);
    const bullet2 = limitWords(pitchAngle ? `Pitch: ${pitchAngle}` : 'Pitch: practical education topic');
    const bullet3 = limitWords(criticalRisk ? `Risk: ${criticalRisk}` : (result.verdict === 'consider' ? 'Next: confirm audience composition' : 'Next: book scheduling and link policy'));

    const text = `${paragraph}\n\nKey points:\n- ${bullet1}\n- ${bullet2}\n- ${bullet3}`;

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
