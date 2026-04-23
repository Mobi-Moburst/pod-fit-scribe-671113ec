import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Company, Speaker, Competitor } from '@/types/clients';
import { useToast } from '@/components/ui/use-toast';
import { pickTopAudienceTags } from '@/lib/campaignStrategy';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import { Trash, Sparkles, Loader2, Plus, X, Building2, User, Globe, ImageIcon, Pencil, Check, Upload, Link2, Download, Archive, History } from 'lucide-react';
import { AirtableConnectionDialog } from '@/components/airtable/AirtableConnectionDialog';
import { ImportFromAirtableDialog } from '@/components/airtable/ImportFromAirtableDialog';
import { SyncFathomButton } from '@/components/call-notes/SyncFathomButton';
import { CompanyCard } from '@/components/companies/CompanyCard';
import { SpeakerProfileCard } from '@/components/companies/SpeakerProfileCard';
import { AEOAuditHistory } from '@/components/companies/AEOAuditHistory';

const emptyCompany: Omit<Company, 'id'> = {
  name: '', company_url: '', logo_url: '', brand_colors: undefined, campaign_manager: '', airtable_embed_url: '', product_type: '', tags: [], notes: '',
};

const emptySpeaker: Omit<Speaker, 'id' | 'company_id'> = {
  name: '', title: '', headshot_url: '', media_kit_url: '', airtable_embed_url: '', gender: undefined,
  target_audiences: [], talking_points: [], avoid: [], guest_identity_tags: [], professional_credentials: [],
  campaign_strategy: '', pitch_template: '', competitors: [],
};

interface CompanyWithSpeakers extends Company {
  speakers: Speaker[];
}

const Companies = () => {
  useEffect(() => { document.title = 'Companies — Podcast Fit Rater'; }, []);
  const [companies, setCompanies] = useState<CompanyWithSpeakers[]>([]);
  const [editingCompany, setEditingCompany] = useState<(Company & { isNew?: boolean }) | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<(Speaker & { isNew?: boolean; avoid_text?: string }) | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [managerFilter, setManagerFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [isSuggestingCompetitors, setIsSuggestingCompetitors] = useState(false);
  const [isFetchingBrand, setIsFetchingBrand] = useState(false);
  const [isScrapingStrategy, setIsScrapingStrategy] = useState(false);
  const [isFetchingHeadshot, setIsFetchingHeadshot] = useState(false);
  const [showManualLogoInput, setShowManualLogoInput] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [airtableDialog, setAirtableDialog] = useState<{ companyId?: string; speakerId?: string; entityName: string } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [aeoHistoryFor, setAeoHistoryFor] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  // ── Data fetching ──
  const fetchCompanyBrand = async () => {
    if (!editingCompany?.company_url) { toast({ title: 'Enter a company URL first', variant: 'destructive' }); return; }
    setIsFetchingBrand(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-company-brand', { body: { url: editingCompany.company_url } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch brand');
      let updated = { ...editingCompany };
      if (data.logo_url) { updated.logo_url = data.logo_url; setShowManualLogoInput(false); setLogoError(false); }
      if (data.brand_colors) updated.brand_colors = data.brand_colors;
      if (data.logo_url || data.brand_colors) toast({ title: 'Brand fetched', description: data.logo_url ? 'Logo and colors loaded.' : 'Brand colors loaded.' });
      else toast({ title: 'No branding found', variant: 'destructive' });
      setEditingCompany(updated);
    } catch (error) {
      toast({ title: 'Failed to fetch brand', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsFetchingBrand(false); }
  };

  const scrapeStrategyFromMediaKit = async () => {
    if (!editingSpeaker?.media_kit_url) { toast({ title: 'Enter a media kit URL first', variant: 'destructive' }); return; }
    setIsScrapingStrategy(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-campaign-strategy', {
        body: { url: editingSpeaker.media_kit_url, speaker_name: editingSpeaker.name, speaker_title: editingSpeaker.title },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to extract strategy');
      const speakerTitle = data.speaker_title || '';
      const audiences = data.target_audiences || [];
      const talking = data.talking_points || [];
      const avoid = data.avoid || [];
      const guest_identity_tags = data.guest_identity_tags || [];
      const campaign_strategy = data.campaign_strategy || editingSpeaker.campaign_strategy || '';
      setEditingSpeaker({ ...editingSpeaker, campaign_strategy, title: speakerTitle || editingSpeaker.title, target_audiences: audiences, talking_points: talking, avoid, avoid_text: avoid.join(', '), guest_identity_tags });
      toast({ title: 'Strategy generated', description: `${audiences.length} audiences, ${talking.length} talking points, ${avoid.length} avoid items, ${guest_identity_tags.length} identity tags extracted.` });
    } catch (error) {
      toast({ title: 'Failed to generate strategy', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsScrapingStrategy(false); }
  };

  const fetchHeadshotFromMediaKit = async () => {
    if (!editingSpeaker?.media_kit_url) { toast({ title: 'Enter a media kit URL first', variant: 'destructive' }); return; }
    setIsFetchingHeadshot(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-speaker-headshot', {
        body: { url: editingSpeaker.media_kit_url },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'No headshot found');
      setEditingSpeaker({ ...editingSpeaker, headshot_url: data.headshot_url });
      toast({ title: 'Headshot found', description: 'Image loaded from media kit.' });
    } catch (error) {
      toast({ title: 'No headshot found', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsFetchingHeadshot(false); }
  };

  const managers = useMemo(() => {
    const names = new Set<string>();
    companies.forEach((c) => (c.campaign_manager || '').split(',').map(m => m.trim()).filter(Boolean).forEach(m => names.add(m)));
    return Array.from(names).sort();
  }, [companies]);
  const filtered = useMemo(() => {
    const byView = companies.filter((c) => viewMode === 'active' ? !c.archived_at : !!c.archived_at);
    return byView.filter((c) => !managerFilter || (c.campaign_manager || '').split(',').map(m => m.trim()).includes(managerFilter)).sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, managerFilter, viewMode]);
  const archivedCount = useMemo(() => companies.filter(c => !!c.archived_at).length, [companies]);

  const loadData = async () => {
    const [companiesRes, speakersRes] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('speakers').select('*').order('created_at', { ascending: false }),
    ]);
    if (companiesRes.error) { toast({ title: 'Error', description: 'Failed to load companies.', variant: 'destructive' }); return; }
    const speakersMap = new Map<string, Speaker[]>();
    (speakersRes.data || []).forEach((s: any) => {
      const speaker: Speaker = {
        id: s.id, company_id: s.company_id, name: s.name, title: s.title || '', headshot_url: s.headshot_url || '',
        media_kit_url: s.media_kit_url || '', airtable_embed_url: s.airtable_embed_url || '', gender: s.gender,
        target_audiences: s.target_audiences || [], talking_points: s.talking_points || [], avoid: s.avoid || [],
        guest_identity_tags: s.guest_identity_tags || [], professional_credentials: s.professional_credentials || [],
        campaign_strategy: s.campaign_strategy || '', pitch_template: s.pitch_template || '', competitors: s.competitors || [],
        archived_at: s.archived_at || null, quarterly_notes: s.quarterly_notes || null,
      };
      const existing = speakersMap.get(s.company_id) || [];
      existing.push(speaker);
      speakersMap.set(s.company_id, existing);
    });
    setCompanies((companiesRes.data || []).map((c: any) => ({
      id: c.id, name: c.name, company_url: c.company_url || '', logo_url: c.logo_url || '',
      brand_colors: c.brand_colors || undefined, campaign_manager: c.campaign_manager || '',
      airtable_embed_url: c.airtable_embed_url || '', product_type: c.product_type || '',
      tags: c.tags || [], notes: c.notes || '', speakers: speakersMap.get(c.id) || [],
      archived_at: c.archived_at || null,
    })));
  };

  useEffect(() => { loadData(); }, []);

  const toggleCompany = (id: string) => {
    setExpandedCompanies(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // ── Company CRUD ──
  const startNewCompany = () => { setEditingCompany({ ...emptyCompany, id: crypto.randomUUID(), isNew: true }); setShowManualLogoInput(false); setLogoError(false); };
  const startEditCompany = (c: Company) => { setEditingCompany({ ...c }); setShowManualLogoInput(false); setLogoError(false); };
  const cancelCompany = () => setEditingCompany(null);
  const canSaveCompany = useMemo(() => editingCompany ? editingCompany.name.trim().length > 0 : false, [editingCompany]);

  const saveCompany = async () => {
    if (!editingCompany || !canSaveCompany) return;
    const isNew = editingCompany.isNew;
    const payload = {
      name: editingCompany.name.trim(), company_url: editingCompany.company_url?.trim() || null,
      logo_url: editingCompany.logo_url?.trim() || null, brand_colors: (editingCompany.brand_colors || null) as any,
      campaign_manager: editingCompany.campaign_manager?.trim() || null, airtable_embed_url: editingCompany.airtable_embed_url?.trim() || null,
      product_type: editingCompany.product_type?.trim() || '', tags: editingCompany.tags || [], notes: editingCompany.notes?.trim() || '',
    };
    if (isNew) {
      const { error } = await supabase.from('companies').insert([{ id: editingCompany.id, org_id: TEAM_ORG_ID, ...payload }]);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('companies').update(payload).eq('id', editingCompany.id);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    }
    setEditingCompany(null); await loadData(); toast({ title: 'Company saved' });
  };

  const removeCompany = async (id: string) => {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    await loadData();
  };

  // ── Speaker CRUD ──
  const startNewSpeaker = (companyId: string) => {
    setEditingSpeaker({ ...emptySpeaker, id: crypto.randomUUID(), company_id: companyId, isNew: true, avoid_text: '' });
    setExpandedCompanies(prev => new Set(prev).add(companyId));
  };
  const startEditSpeaker = (s: Speaker) => { setEditingSpeaker({ ...s, avoid_text: (s.avoid || []).join(', ') }); };
  const cancelSpeaker = () => setEditingSpeaker(null);
  const canSaveSpeaker = useMemo(() => {
    if (!editingSpeaker) return false;
    const hasName = editingSpeaker.name.trim().length > 0;
    const hasMediaKitUrl = (editingSpeaker.media_kit_url || '').trim().length > 0;
    const isValidMediaKitUrl = /^https?:\/\/.+/.test((editingSpeaker.media_kit_url || '').trim());
    const hasCampaignStrategy = (editingSpeaker.campaign_strategy || '').trim().length > 0;
    return hasName && hasMediaKitUrl && isValidMediaKitUrl && hasCampaignStrategy;
  }, [editingSpeaker]);

  const saveSpeaker = async () => {
    if (!editingSpeaker || !canSaveSpeaker) return;
    const isNew = editingSpeaker.isNew;
    const payload = {
      company_id: editingSpeaker.company_id, name: editingSpeaker.name.trim(), title: editingSpeaker.title?.trim() || null,
      headshot_url: editingSpeaker.headshot_url?.trim() || null, media_kit_url: editingSpeaker.media_kit_url?.trim() || '',
      airtable_embed_url: editingSpeaker.airtable_embed_url?.trim() || null, gender: editingSpeaker.gender || null,
      target_audiences: editingSpeaker.target_audiences || [], talking_points: editingSpeaker.talking_points || [],
      avoid: editingSpeaker.avoid || [], guest_identity_tags: editingSpeaker.guest_identity_tags || [],
      professional_credentials: editingSpeaker.professional_credentials || [],
      campaign_strategy: editingSpeaker.campaign_strategy?.trim() || '', pitch_template: editingSpeaker.pitch_template?.trim() || null,
      competitors: (editingSpeaker.competitors || []) as any,
    };
    if (isNew) {
      const { error } = await supabase.from('speakers').insert([{ id: editingSpeaker.id, org_id: TEAM_ORG_ID, ...payload } as any]);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('speakers').update(payload as any).eq('id', editingSpeaker.id);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    }
    setEditingSpeaker(null); await loadData(); toast({ title: 'Speaker saved' });
  };

  const removeSpeaker = async (id: string) => {
    const { error } = await supabase.from('speakers').delete().eq('id', id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    await loadData();
  };

  // ── Archive/Restore ──
  const archiveCompany = async (id: string) => {
    const { error } = await supabase.from('companies').update({ archived_at: new Date().toISOString() } as any).eq('id', id);
    if (error) { toast({ title: 'Archive failed', description: error.message, variant: 'destructive' }); return; }
    // Also archive all speakers under this company
    await supabase.from('speakers').update({ archived_at: new Date().toISOString() } as any).eq('company_id', id);
    await loadData(); toast({ title: 'Company archived' });
  };

  const restoreCompany = async (id: string) => {
    const { error } = await supabase.from('companies').update({ archived_at: null } as any).eq('id', id);
    if (error) { toast({ title: 'Restore failed', description: error.message, variant: 'destructive' }); return; }
    // Also restore all speakers under this company
    await supabase.from('speakers').update({ archived_at: null } as any).eq('company_id', id);
    await loadData(); toast({ title: 'Company restored' });
  };

  const archiveSpeaker = async (id: string) => {
    const { error } = await supabase.from('speakers').update({ archived_at: new Date().toISOString() } as any).eq('id', id);
    if (error) { toast({ title: 'Archive failed', description: error.message, variant: 'destructive' }); return; }
    await loadData(); toast({ title: 'Speaker archived' });
  };

  const restoreSpeaker = async (id: string) => {
    const { error } = await supabase.from('speakers').update({ archived_at: null } as any).eq('id', id);
    if (error) { toast({ title: 'Restore failed', description: error.message, variant: 'destructive' }); return; }
    await loadData(); toast({ title: 'Speaker restored' });
  };

  // ── Competitor helpers ──
  const suggestCompetitors = async () => {
    if (!editingSpeaker) return;
    setIsSuggestingCompetitors(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-competitors', { body: { client: editingSpeaker } });
      if (error) throw error;
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        setEditingSpeaker({ ...editingSpeaker, competitors: data.suggestions.map((s: any) => ({ name: s.name, role: s.role, peer_reason: s.peer_reason })) });
        toast({ title: 'Competitors suggested', description: `AI identified ${data.suggestions.length} peer thought leaders.` });
      }
    } catch (error) {
      toast({ title: 'Failed to suggest competitors', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsSuggestingCompetitors(false); }
  };

  const addCompetitor = () => { if (!editingSpeaker) return; setEditingSpeaker({ ...editingSpeaker, competitors: [...(editingSpeaker.competitors || []), { name: '', role: '', peer_reason: '' }] }); };
  const updateCompetitor = (index: number, field: keyof Competitor, value: string) => { if (!editingSpeaker) return; const updated = [...(editingSpeaker.competitors || [])]; updated[index] = { ...updated[index], [field]: value }; setEditingSpeaker({ ...editingSpeaker, competitors: updated }); };
  const removeCompetitor = (index: number) => { if (!editingSpeaker) return; setEditingSpeaker({ ...editingSpeaker, competitors: (editingSpeaker.competitors || []).filter((_, i) => i !== index) }); };
  const toList = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        {/* Header */}
        <Card className="p-4 card-surface flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold">Companies</h1>
            <p className="text-sm text-muted-foreground">Manage companies and their speakers for podcast campaigns.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Download className="h-4 w-4 mr-2" />Import from Airtable
            </Button>
            <Button variant="hero" onClick={startNewCompany}>
              <Building2 className="h-4 w-4 mr-2" />New Company
            </Button>
          </div>
        </Card>

        <ImportFromAirtableDialog open={showImportDialog} onOpenChange={setShowImportDialog} existingCompanies={companies.map(c => ({ id: c.id, name: c.name }))} onImportComplete={loadData} />

        {/* View mode tabs + Filter */}
        <div className="flex items-center gap-4 flex-wrap">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'active' | 'archived')} className="w-auto">
            <TabsList className="h-9">
              <TabsTrigger value="active" className="text-xs px-3">Active</TabsTrigger>
              <TabsTrigger value="archived" className="text-xs px-3">
                <Archive className="h-3 w-3 mr-1.5" />Archived{archivedCount > 0 && ` (${archivedCount})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {managers.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">Campaign Manager</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
                <option value="">All</option>
                {managers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          {managerFilter && <SyncFathomButton onSyncComplete={loadData} />}
        </div>

        {/* Company Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(company => (
            <CompanyCard
              key={company.id}
              company={company}
              isExpanded={expandedCompanies.has(company.id)}
              onToggle={() => toggleCompany(company.id)}
              onEdit={() => startEditCompany(company)}
              onDelete={() => removeCompany(company.id)}
              onAddSpeaker={() => startNewSpeaker(company.id)}
              onAirtable={() => setAirtableDialog({ companyId: company.id, entityName: company.name })}
              isArchived={!!company.archived_at}
              onArchive={() => archiveCompany(company.id)}
              onRestore={() => restoreCompany(company.id)}
            >
              {company.speakers.map(speaker => (
                <SpeakerProfileCard
                  key={speaker.id}
                  speaker={speaker}
                  companyName={company.name}
                  onEdit={() => startEditSpeaker(speaker)}
                  onDelete={() => removeSpeaker(speaker.id)}
                  onAirtable={() => setAirtableDialog({ companyId: company.id, speakerId: speaker.id, entityName: speaker.name })}
                  onUpdate={loadData}
                  isArchived={!!speaker.archived_at}
                  onArchive={() => archiveSpeaker(speaker.id)}
                  onRestore={() => restoreSpeaker(speaker.id)}
                />
              ))}
            </CompanyCard>
          ))}
          {!filtered.length && (
            <p className="text-sm text-muted-foreground col-span-full">
              {viewMode === 'archived' ? 'No archived companies.' : 'No companies yet.'}
            </p>
          )}
        </div>

        {/* ═══ Company Edit Sheet ═══ */}
        <Sheet open={!!editingCompany} onOpenChange={(open) => !open && cancelCompany()}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {editingCompany?.isNew ? 'New Company' : 'Edit Company'}
              </SheetTitle>
            </SheetHeader>
            {editingCompany && (
              <div className="grid gap-4 mt-4">
                <div>
                  <Label className="flex items-center gap-1">Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Acme Inc." value={editingCompany.name} onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })} />
                </div>
                <div>
                  <Label>Campaign Manager</Label>
                  <Input placeholder="e.g., Troy, Kylie" value={editingCompany.campaign_manager || ''} onChange={(e) => setEditingCompany({ ...editingCompany, campaign_manager: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Separate multiple with commas</p>
                </div>
                <div>
                  <Label>Company URL</Label>
                  <div className="flex gap-2">
                    <Input placeholder="https://acme.com" value={editingCompany.company_url || ''} onChange={(e) => setEditingCompany({ ...editingCompany, company_url: e.target.value })} className="flex-1" />
                    <Button type="button" variant="outline" size="icon" onClick={fetchCompanyBrand} disabled={isFetchingBrand || !editingCompany.company_url?.trim()} title="Fetch logo from website">
                      {isFetchingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Company Logo</Label>
                  {editingCompany.logo_url && !logoError ? (
                    <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                      <img src={editingCompany.logo_url} alt="Company logo" className="w-10 h-10 rounded object-contain bg-background" onError={() => setLogoError(true)} />
                      <p className="text-sm text-muted-foreground flex-1 flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Logo loaded</p>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowManualLogoInput(!showManualLogoInput)}><Pencil className="h-3 w-3" /></Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingCompany({ ...editingCompany, logo_url: '' }); setLogoError(false); }}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-md border border-dashed border-border bg-muted/20">
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>
                      <p className="text-sm text-muted-foreground flex-1">{logoError ? 'Failed to load logo' : 'No logo'}</p>
                      <Button type="button" variant="outline" size="sm" onClick={fetchCompanyBrand} disabled={isFetchingBrand || !editingCompany.company_url?.trim()}>
                        {isFetchingBrand ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Globe className="h-3 w-3 mr-1" />}Fetch
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowManualLogoInput(true)}>Enter URL</Button>
                    </div>
                  )}
                  {showManualLogoInput && (
                    <div className="flex gap-2 mt-2">
                      <Input placeholder="https://acme.com/logo.png" value={editingCompany.logo_url || ''} onChange={(e) => { setEditingCompany({ ...editingCompany, logo_url: e.target.value }); setLogoError(false); }} className="flex-1" />
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowManualLogoInput(false)}>Done</Button>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Airtable View URL</Label>
                  <Input placeholder="https://airtable.com/app.../shr..." value={editingCompany.airtable_embed_url || ''} onChange={(e) => setEditingCompany({ ...editingCompany, airtable_embed_url: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea rows={3} placeholder="Internal notes about this company..." value={editingCompany.notes || ''} onChange={(e) => setEditingCompany({ ...editingCompany, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={cancelCompany}>Cancel</Button>
                  <Button variant="hero" onClick={saveCompany} disabled={!canSaveCompany}>Save Company</Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* ═══ Speaker Edit Sheet ═══ */}
        <Sheet open={!!editingSpeaker} onOpenChange={(open) => !open && cancelSpeaker()}>
          <SheetContent side="right" className="w-full sm:max-w-xl p-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {editingSpeaker?.isNew ? 'New Speaker' : 'Edit Speaker'}
                  </SheetTitle>
                </SheetHeader>
                {editingSpeaker && (
                  <div className="grid gap-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-1">Name <span className="text-destructive">*</span></Label>
                        <Input placeholder="John Doe" value={editingSpeaker.name} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Title</Label>
                        <Input placeholder="e.g., CEO & Founder" value={editingSpeaker.title || ''} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, title: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Gender</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingSpeaker.gender || ''} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, gender: e.target.value as any })}>
                          <option value="">Prefer not to specify</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="non_binary">Non-binary</option>
                        </select>
                      </div>
                      <div>
                        <Label className="flex items-center gap-1">Media Kit URL <span className="text-destructive">*</span></Label>
                        <Input placeholder="https://..." value={editingSpeaker.media_kit_url || ''} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, media_kit_url: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Headshot</Label>
                      <div className="flex items-center gap-4 mt-2">
                        {editingSpeaker.headshot_url ? (
                          <div className="relative group">
                            <img src={editingSpeaker.headshot_url} alt="Speaker headshot" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                            <button type="button" onClick={() => setEditingSpeaker({ ...editingSpeaker, headshot_url: '' })} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <input type="file" accept="image/*" id="headshot-upload" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${editingSpeaker.id || crypto.randomUUID()}-${Date.now()}.${fileExt}`;
                            const { error } = await supabase.storage.from('speaker-headshots').upload(fileName, file, { upsert: true });
                            if (error) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); return; }
                            const { data: { publicUrl } } = supabase.storage.from('speaker-headshots').getPublicUrl(fileName);
                            setEditingSpeaker({ ...editingSpeaker, headshot_url: publicUrl });
                            toast({ title: 'Headshot uploaded!' });
                          }} />
                          <label htmlFor="headshot-upload" className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer transition-colors">
                            <Upload className="w-4 h-4" />{editingSpeaker.headshot_url ? 'Change Photo' : 'Upload Photo'}
                          </label>
                          <Button type="button" variant="outline" size="sm" onClick={fetchHeadshotFromMediaKit} disabled={isFetchingHeadshot || !editingSpeaker.media_kit_url?.trim()} className="ml-2">
                            {isFetchingHeadshot ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Fetching...</> : <><Globe className="h-3 w-3 mr-1" />Fetch from Media Kit</>}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">Square image recommended</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Airtable Embed URL</Label>
                      <Input placeholder="https://airtable.com/..." value={editingSpeaker.airtable_embed_url || ''} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, airtable_embed_url: e.target.value })} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="flex items-center gap-1">Campaign Strategy <span className="text-destructive">*</span></Label>
                        <Button type="button" variant="outline" size="sm" onClick={scrapeStrategyFromMediaKit} disabled={isScrapingStrategy || !editingSpeaker.media_kit_url?.trim()}>
                          {isScrapingStrategy ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating...</> : <><Sparkles className="h-3 w-3 mr-1" />Generate from Media Kit</>}
                        </Button>
                      </div>
                      <Textarea rows={6} placeholder="Freeform strategy narrative, positioning notes, etc." value={editingSpeaker.campaign_strategy || ''} onChange={(e) => {
                        setEditingSpeaker({ ...editingSpeaker, campaign_strategy: e.target.value });
                      }} />
                    </div>
                    <div>
                      <Label>Target Audiences</Label>
                      <Textarea rows={2} placeholder="e.g., Startup Founders, Enterprise CTOs, Growth Marketers" value={(editingSpeaker.target_audiences || []).join(', ')} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, target_audiences: toList(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Talking Points</Label>
                      <Textarea rows={3} placeholder="e.g., AI in Sales, Building Remote Teams, Scaling Product-Led Growth" value={(editingSpeaker.talking_points || []).join(', ')} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, talking_points: toList(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Things to Avoid</Label>
                      <Textarea rows={2} placeholder="crypto, MLM, NFT" value={editingSpeaker.avoid_text || ''} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, avoid_text: e.target.value, avoid: toList(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Guest Identity Tags</Label>
                      <Textarea rows={2} placeholder="e.g., woman_entrepreneur, black_founder" value={(editingSpeaker.guest_identity_tags || []).join(', ')} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, guest_identity_tags: toList(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Custom Pitch Template (Optional)</Label>
                      <Textarea rows={6} placeholder={`Hey [host_first_name],\n\nI'd like to recommend a guest...`} value={editingSpeaker.pitch_template || ''} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, pitch_template: e.target.value })} />
                    </div>

                    {/* Competitors */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Label className="text-base">Competitors</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Identify 2-3 peers who compete for share-of-voice</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={suggestCompetitors} disabled={isSuggestingCompetitors || !editingSpeaker.name}>
                          {isSuggestingCompetitors ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Suggesting...</> : <><Sparkles className="h-4 w-4 mr-1" />Suggest</>}
                        </Button>
                      </div>
                      {editingSpeaker.competitors && editingSpeaker.competitors.length > 0 && (
                        <div className="space-y-3 mb-3">
                          {editingSpeaker.competitors.map((comp, idx) => (
                            <Card key={idx} className="p-3 bg-muted/30">
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground">Competitor {idx + 1}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeCompetitor(idx)}><X className="h-3 w-3" /></Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div><Label className="text-xs">Name</Label><Input placeholder="John Smith" value={comp.name} onChange={(e) => updateCompetitor(idx, 'name', e.target.value)} /></div>
                                <div><Label className="text-xs">Role</Label><Input placeholder="CEO, Acme Corp" value={comp.role} onChange={(e) => updateCompetitor(idx, 'role', e.target.value)} /></div>
                              </div>
                              <div className="mb-2"><Label className="text-xs">LinkedIn</Label><Input placeholder="https://linkedin.com/in/..." value={comp.linkedin_url || ''} onChange={(e) => updateCompetitor(idx, 'linkedin_url', e.target.value)} /></div>
                              <div><Label className="text-xs">Why peer?</Label><Textarea rows={2} value={comp.peer_reason} onChange={(e) => updateCompetitor(idx, 'peer_reason', e.target.value)} /></div>
                            </Card>
                          ))}
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={addCompetitor}><Plus className="h-4 w-4 mr-1" />Add Competitor</Button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={cancelSpeaker}>Cancel</Button>
                      <Button variant="hero" onClick={saveSpeaker} disabled={!canSaveSpeaker}>Save Speaker</Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Airtable Connection Dialog */}
        <AirtableConnectionDialog open={!!airtableDialog} onOpenChange={(open) => !open && setAirtableDialog(null)} companyId={airtableDialog?.companyId} speakerId={airtableDialog?.speakerId} entityName={airtableDialog?.entityName || ''} />
      </main>
    </div>
  );
};

export default Companies;
