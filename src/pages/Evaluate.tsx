
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
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import { ClientCombobox } from '@/components/ClientCombobox';
const Evaluate = () => {
  useEffect(() => { document.title = 'Evaluate — Podcast Fit Rater'; }, []);
  const { toast } = useToast();

  const [url, setUrl] = useState('');
  const [paste, setPaste] = useState('');
  const [clients, setClients] = useState<MinimalClient[]>([]);
  const [clientId, setClientId] = useState('');
  const client = useMemo(() => clients.find(c => c.id === clientId)!, [clients, clientId]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (!error) {
        const mapped = (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          company: c.company || '',
          media_kit_url: c.media_kit_url || '',
          target_audiences: c.target_audiences || [],
          talking_points: c.talking_points || [],
          avoid: c.avoid || [],
          avoid_text: Array.isArray(c.avoid) ? c.avoid.join(', ') : '',
          notes: c.notes || '',
          campaign_strategy: c.campaign_strategy || '',
          campaign_manager: c.campaign_manager || '',
        }));
        setClients(mapped);
      }
    })();
  }, []);

  const [loading, setLoading] = useState(false);
const [result, setResult] = useState<(AnalyzeResult & { show_title?: string; last_publish_date?: string }) | null>(null);
const [showNotesOpen, setShowNotesOpen] = useState(false);

   const handleAnalyze = async () => {
    setLoading(true); setResult(null);
    try {
      let notes = paste.trim();
      let title: string | undefined;
      let publishDate: string | undefined;
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
        publishDate = s.publish_date;
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
      if (!resp.success) {
        // Handle specific timeout and API errors with retry options
        if (resp.error === 'timeout') {
          toast({
            title: 'Analysis timed out',
            description: 'AI analysis took too long. Click Analyze again to retry.',
            variant: 'destructive'
          });
          return;
        } else if (resp.error === 'rate_limit') {
          toast({
            title: 'Rate limit reached',
            description: 'API limit reached. Try again in a few minutes.',
            variant: 'destructive'
          });
          return;
        } else if (resp.error === 'missing_api_key') {
          toast({
            title: 'Missing API key',
            description: 'Add your OpenAI API key in Supabase Edge Function secrets.',
            variant: 'destructive'
          });
          return;
        }
        
        // Generic error handling
        const rawStr = resp.raw ? String(resp.raw) : '';
        const snippet = rawStr ? rawStr.slice(0, 200) + (rawStr.length > 200 ? '…' : '') : '';
        const desc = resp.error ? `${resp.error}${snippet ? ' — ' + snippet : ''}` : 'Analysis failed. Please try again.';
        toast({ title: 'Analysis failed', description: desc, variant: 'destructive' });
        return;
      }
      setResult({ ...resp.data, show_title: title, last_publish_date: publishDate });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Unexpected error. Try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    const { error } = await supabase.from('evaluations').insert([
      {
        org_id: TEAM_ORG_ID,
        client_id: clientId,
        url: url || 'manual',
        show_title: result.show_title || null,
        overall_score: (result as any).overall_score ?? null,
        confidence: (result as any).confidence ?? null,
        rubric_json: result as any,
        citations: (result as any).citations ?? null,
        show_notes_excerpt: paste ? paste.slice(0, 500) : null,
      } as any,
    ]);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: 'Added to shared History.' });
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

    const clientName = (client?.name || 'the client').trim();
    const showName = (result.show_title || 'this show').trim();

    // Use AI-generated summary as the main content when available
    let mainSummary = result.summary_text || '';

    // If no AI summary or it's too generic/short, create a fallback
    if (!mainSummary || mainSummary.length < 80) {
      const verdictWord = result.verdict === 'recommend' ? 'Recommend' : result.verdict === 'consider' ? 'Consider' : 'Not recommended';
      
      const topicItems = (result.why_fit_structured || []).map((w: any) => clean(w.claim || '')).filter(Boolean);
      const legacyTopics = (result.why_fit || []).map(clean).filter(Boolean);
      const allTopics = topicItems.length ? topicItems : legacyTopics;
      
      const inferredSegments = (result as any).audience_segments as string[] | undefined;
      const targetSegs = client?.target_audiences || [];
      const segs = (inferredSegments && inferredSegments.length ? inferredSegments : targetSegs).map(clean).filter(Boolean).slice(0, 2);
      const audiencePhrase = segs.length ? segs.join(' and ') : 'target audience';
      const themes = allTopics.slice(0, 2).join(' and ') || 'relevant business topics';
      
      mainSummary = `${verdictWord} for ${clientName} on ${showName}. This show reaches ${audiencePhrase}, creating opportunities around ${themes}. The audience alignment and content focus support the campaign goals effectively.`;
    }

    // Create dynamic bullet points from actual analysis data
    const bullets: string[] = [];

    // Audience insight - use inferred or client target
    const bulletInferredSegments = (result as any).audience_segments as string[] | undefined;
    const bulletTargetSegs = client?.target_audiences || [];
    const bulletSegs = (bulletInferredSegments && bulletInferredSegments.length ? bulletInferredSegments : bulletTargetSegs).map(clean).filter(Boolean).slice(0, 2);
    const audienceText = bulletSegs.length ? bulletSegs.join(' and ') : 'target audience';
    bullets.push(`Audience: ${audienceText}`);

    // Best opportunity from talking points or fit reasons
    const bulletPitchTopics = (result.recommended_talking_points || []).map(clean).filter(Boolean);
    const bulletTopicItems = (result.why_fit_structured || []).map((w: any) => clean(w.claim || '')).filter(Boolean);
    const bulletLegacyTopics = (result.why_fit || []).map(clean).filter(Boolean);
    const bulletAllTopics = bulletTopicItems.length ? bulletTopicItems : bulletLegacyTopics;
    
    const bestOpportunity = bulletPitchTopics[0] || bulletAllTopics[0];
    if (bestOpportunity) {
      const truncated = bestOpportunity.length > 60 ? bestOpportunity.slice(0, 60) + '...' : bestOpportunity;
      bullets.push(`Opportunity: ${truncated}`);
    }

    // Key risk or next step based on verdict
    const riskItems = (result.risk_flags_structured || []).map((r: any) => clean(r.flag || '')).filter(Boolean);
    const legacyRisks = (result.risk_flags || []).map(clean).filter(Boolean);
    const allRisks = riskItems.length ? riskItems : legacyRisks;
    
    const criticalRisk = allRisks.find(r => r.toLowerCase().includes('critical')) || allRisks[0];
    
    if (criticalRisk) {
      const truncated = criticalRisk.length > 60 ? criticalRisk.slice(0, 60) + '...' : criticalRisk;
      bullets.push(`Risk: ${truncated}`);
    } else if (result.verdict === 'consider') {
      bullets.push('Next: Confirm audience composition with host');
    } else if (result.verdict === 'recommend') {
      bullets.push('Next: Prepare targeted pitch and book');
    } else {
      bullets.push('Next: Find shows with better audience alignment');
    }

    const text = `${mainSummary}\n\nKey insights:\n${bullets.map(b => `• ${b}`).join('\n')}`;

    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'AI-powered summary copied to clipboard.' });
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
              <ClientCombobox clients={clients} value={clientId} onChange={setClientId} />
              <div className="text-xs text-muted-foreground">Seeded from saved Clients. Manage in Clients tab.</div>
              <div className="flex gap-2 mt-2">
                <Button variant="hero" className="flex-1" onClick={handleAnalyze} disabled={!clientId}>Analyze</Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!clientId}
                  onClick={() => {
                    const list = (sampleUrls as Record<string, string[]>)[clientId] || [];
                    setUrl(list[Math.floor(Math.random()*list.length)] || '');
                  }}
                >
                  Try Sample
                </Button>
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
