import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { CompanySpeakerSelector } from '@/components/CompanySpeakerSelector';
import { SpeakerContextRail } from '@/components/research/SpeakerContextRail';
import { DiscoverTab } from '@/components/research/DiscoverTab';
import { ShortlistTab, type ShortlistRow } from '@/components/research/ShortlistTab';
import { AnglesPanel } from '@/components/research/AnglesPanel';
import { PipelineTab } from '@/components/research/PipelineTab';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import type { Company, Speaker } from '@/types/clients';
import { Search, Layers, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeShowName } from '@/lib/hubspot';

const legacyTools = [
  { id: 'evaluate', label: 'Evaluate', description: 'Score a single podcast.', path: '/evaluate?embedded=1', icon: Search },
  { id: 'batch', label: 'Batch', description: 'Score many podcasts from a CSV.', path: '/batch?embedded=1', icon: Layers },
  { id: 'history', label: 'History', description: 'Browse past evaluations.', path: '/history?embedded=1', icon: Clock },
] as const;

type LegacyTool = (typeof legacyTools)[number];

const Research = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [speakerId, setSpeakerId] = useState<string | null>(searchParams.get('speaker'));
  const [tab, setTab] = useState<'discover' | 'shortlist' | 'pipeline'>('discover');
  const [hubspotTicketNames, setHubspotTicketNames] = useState<Set<string>>(new Set());
  const [shortlist, setShortlist] = useState<ShortlistRow[]>([]);
  const [selectedShortlistId, setSelectedShortlistId] = useState<string | null>(null);
  const [bookedCount, setBookedCount] = useState(0);
  const [bookedShows, setBookedShows] = useState<{ id: string; show_title: string | null; url: string; created_at: string | null }[]>([]);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacyActive, setLegacyActive] = useState<LegacyTool | null>(null);

  useEffect(() => {
    document.title = 'Research — Kitcaster Campaign Command Center';
  }, []);

  // Initial data load
  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: ss }] = await Promise.all([
        supabase.from('companies').select('*').is('archived_at', null).order('name'),
        supabase.from('speakers').select('*').is('archived_at', null).order('name'),
      ]);
      setCompanies((cs || []) as Company[]);
      setSpeakers((ss || []) as unknown as Speaker[]);
    })();
  }, []);

  // Sync speaker from URL → infer company
  useEffect(() => {
    if (speakerId && !companyId && speakers.length > 0) {
      const s = speakers.find((x) => x.id === speakerId);
      if (s) setCompanyId(s.company_id);
    }
  }, [speakerId, companyId, speakers]);

  // Persist speaker to URL
  useEffect(() => {
    if (speakerId) {
      setSearchParams({ speaker: speakerId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [speakerId, setSearchParams]);

  const speaker = useMemo(
    () => (speakerId ? speakers.find((s) => s.id === speakerId) : undefined),
    [speakerId, speakers]
  );
  const company = useMemo(
    () => (speaker ? companies.find((c) => c.id === speaker.company_id) : undefined),
    [speaker, companies]
  );

  // Load shortlist + booked count for selected speaker
  useEffect(() => {
    if (!speakerId) {
      setShortlist([]);
      setBookedCount(0);
      setBookedShows([]);
      setSelectedShortlistId(null);
      return;
    }
    loadShortlist();
    (async () => {
      // Pull from speaker-specific reports AND any company report this speaker appears in.
      const speakerCompanyId = speakers.find((s) => s.id === speakerId)?.company_id;
      const queries: any[] = [
        supabase
          .from('reports')
          .select('id, generated_at, report_data')
          .eq('speaker_id', speakerId)
          .order('generated_at', { ascending: false }),
      ];
      if (speakerCompanyId) {
        queries.push(
          supabase
            .from('reports')
            .select('id, generated_at, report_data')
            .eq('company_id', speakerCompanyId)
            .is('speaker_id', null)
            .order('generated_at', { ascending: false })
        );
      }
      const results = await Promise.all(queries);

      type Show = { id: string; show_title: string; url: string; created_at: string | null };
      const seen = new Set<string>();
      const shows: Show[] = [];
      const collect = (podcasts: any[], reportId: string, generatedAt: string | null) => {
        for (const p of podcasts || []) {
          const action = (p.action || '').toLowerCase();
          if (action && !action.includes('podcast recording') && !action.includes('published')) continue;
          const title = (p.show_title || '').trim();
          if (!title) continue;
          const key = title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          shows.push({
            id: `${reportId}:${key}`,
            show_title: title,
            url: p.apple_podcast_link || p.episode_link || '',
            created_at: generatedAt,
          });
        }
      };

      // Speaker reports: top-level podcasts[]
      for (const r of (results[0]?.data || []) as any[]) {
        collect(r.report_data?.podcasts, r.id, r.generated_at);
      }
      // Company reports: filter speaker_breakdowns by this speaker_id
      if (results[1]) {
        for (const r of (results[1].data || []) as any[]) {
          const breakdowns: any[] = r.report_data?.speaker_breakdowns || [];
          const mine = breakdowns.find((b) => b.speaker_id === speakerId);
          if (mine) collect(mine.podcasts, r.id, r.generated_at);
        }
      }

      // Fallback: if no reports yet, fall back to evaluations so the speaker isn't blank.
      if (shows.length === 0) {
        const { data: evals } = await supabase
          .from('evaluations')
          .select('id, show_title, url, created_at')
          .eq('speaker_id', speakerId)
          .order('created_at', { ascending: false });
        for (const e of (evals || []) as any[]) {
          const title = (e.show_title || '').trim();
          const key = (title || e.url || '').toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          shows.push({ id: e.id, show_title: title || e.url, url: e.url, created_at: e.created_at });
        }
      }

      setBookedShows(shows);
      setBookedCount(shows.length);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerId]);

  async function loadShortlist() {
    if (!speakerId) return;
    const { data } = await supabase
      .from('research_shortlists')
      .select('id, show_name, show_url, host_name, description, cover_art_url, categories, niche_fit_score, est_listeners, last_episode_date, status, source')
      .eq('speaker_id', speakerId)
      .order('created_at', { ascending: false });
    setShortlist((data || []) as ShortlistRow[]);
  }

  const shortlistedNames = useMemo(
    () => new Set(shortlist.map((s) => s.show_name.toLowerCase())),
    [shortlist]
  );
  const selectedRow = useMemo(
    () => shortlist.find((r) => r.id === selectedShortlistId) || null,
    [selectedShortlistId, shortlist]
  );

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold mb-1">Research</h1>
          <p className="text-sm text-muted-foreground">
            Source niche, guest-friendly podcasts per speaker and draft pitch angles for HubSpot.
          </p>
        </div>

        {/* Speaker picker */}
        <Card className="card-surface p-4">
          <CompanySpeakerSelector
            companies={companies}
            speakers={speakers}
            selectedCompanyId={companyId}
            selectedSpeakerId={speakerId}
            onCompanyChange={setCompanyId}
            onSpeakerChange={setSpeakerId}
          />
        </Card>

        {!speaker ? (
          <Card className="card-surface p-12 text-center">
            <h2 className="text-base font-semibold mb-2">Pick a speaker to start sourcing</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The Research workspace anchors discovery, shortlists, and pitch angles to a single
              speaker's strategy and audience.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr_360px]">
            {/* Left rail: speaker context */}
            <div className="space-y-3">
              <SpeakerContextRail speaker={speaker} company={company} bookedCount={bookedCount} bookedShows={bookedShows} />

              {/* Legacy tools disclosure */}
              <Collapsible open={legacyOpen} onOpenChange={setLegacyOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <span>Legacy tools</span>
                    {legacyOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1.5 mt-1">
                  {legacyTools.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setLegacyActive(t)}
                        className="w-full flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium">{t.label}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Main column */}
            <div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="discover">Discover</TabsTrigger>
                  <TabsTrigger value="shortlist">
                    Shortlist {shortlist.length > 0 && `(${shortlist.length})`}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="discover" className="mt-4">
                  <DiscoverTab
                    speakerId={speaker.id}
                    orgId={TEAM_ORG_ID}
                    shortlistedNames={shortlistedNames}
                    onShortlisted={loadShortlist}
                  />
                </TabsContent>
                <TabsContent value="shortlist" className="mt-4">
                  <ShortlistTab
                    rows={shortlist}
                    selectedId={selectedShortlistId}
                    onSelect={(id) => setSelectedShortlistId(id)}
                    onChanged={loadShortlist}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Right rail: angles */}
            <div className={cn('lg:sticky lg:top-4 lg:self-start', !selectedRow && 'hidden lg:block')}>
              {selectedRow ? (
                <AnglesPanel row={selectedRow} onClose={() => setSelectedShortlistId(null)} />
              ) : (
                <Card className="card-surface p-6 text-center text-sm text-muted-foreground">
                  Select a shortlisted show to draft pitch angles.
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Legacy tool modal */}
      <Dialog open={!!legacyActive} onOpenChange={(open) => !open && setLegacyActive(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-3 border-b border-border shrink-0">
            <DialogTitle className="text-base">{legacyActive?.label}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-background">
            {legacyActive && (
              <iframe key={legacyActive.id} src={legacyActive.path} title={legacyActive.label} className="w-full h-full border-0" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Research;
