import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Company, Speaker, Competitor } from '@/types/clients';
import { useToast } from '@/components/ui/use-toast';
import { pickTopAudienceTags } from '@/lib/campaignStrategy';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import { Trash, Sparkles, Loader2, Plus, X, Building2, User, Globe, ImageIcon, Pencil, Check, Upload, Link2, Download, Archive, History, Search, ChevronRight, ChevronDown, Pin, PinOff, Users, Clock, LayoutGrid, List, ArrowUpDown, Filter, MoreHorizontal, RotateCcw } from 'lucide-react';
import { AirtableConnectionDialog } from '@/components/airtable/AirtableConnectionDialog';
import { ImportFromAirtableDialog } from '@/components/airtable/ImportFromAirtableDialog';

import { SpeakerProfileCard } from '@/components/companies/SpeakerProfileCard';
import { AEOAuditHistory } from '@/components/companies/AEOAuditHistory';
import { industryStyle } from '@/lib/industryColors';

// Relative timestamp helper
function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

type NavView = 'pinned' | 'my' | 'all' | 'recent' | 'archived';
type SortMode = 'recent' | 'alpha' | 'created' | 'speakers';

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
  industry?: string | null;
  updated_at?: string;
  created_at?: string;
}

const Companies = () => {
  useEffect(() => { document.title = 'Companies — Podcast Fit Rater'; }, []);
  const [companies, setCompanies] = useState<CompanyWithSpeakers[]>([]);
  const [editingCompany, setEditingCompany] = useState<(Company & { isNew?: boolean }) | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<(Speaker & { isNew?: boolean; avoid_text?: string }) | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [managerFilter, setManagerFilter] = useState<string>('');
  const [industryFilter, setIndustryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'with_speakers' | 'no_speakers'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');
  const [navView, setNavView] = useState<NavView>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [pinned, setPinned] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('companies:pinned') || '[]')); } catch { return new Set(); }
  });
  const togglePin = (id: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('companies:pinned', JSON.stringify(Array.from(next)));
      return next;
    });
  };
  const [isInferring, setIsInferring] = useState(false);
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
    const counts = new Map<string, number>();
    companies.filter(c => !c.archived_at).forEach((c) => (c.campaign_manager || '').split(',').map(m => m.trim()).filter(Boolean).forEach(m => counts.set(m, (counts.get(m) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [companies]);
  const industries = useMemo(() => {
    const counts = new Map<string, number>();
    companies.filter(c => !c.archived_at).forEach(c => {
      const ind = (c.industry || '').trim();
      if (ind) counts.set(ind, (counts.get(ind) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [companies]);
  const archivedCount = useMemo(() => companies.filter(c => !!c.archived_at).length, [companies]);
  const pinnedCount = useMemo(() => companies.filter(c => pinned.has(c.id) && !c.archived_at).length, [companies, pinned]);

  const filtered = useMemo(() => {
    let list = companies.slice();
    // Nav view
    if (navView === 'archived') list = list.filter(c => !!c.archived_at);
    else list = list.filter(c => !c.archived_at);
    if (navView === 'pinned') list = list.filter(c => pinned.has(c.id));
    if (navView === 'recent') {
      list.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    }
    // Filters
    if (managerFilter) list = list.filter(c => (c.campaign_manager || '').split(',').map(m => m.trim()).includes(managerFilter));
    if (industryFilter) list = list.filter(c => (c.industry || '') === industryFilter);
    if (statusFilter === 'with_speakers') list = list.filter(c => c.speakers.length > 0);
    if (statusFilter === 'no_speakers') list = list.filter(c => c.speakers.length === 0);
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q)) ||
        c.speakers.some(s => s.name.toLowerCase().includes(q))
      );
    }
    // Sort (recent is already applied above; allow override)
    if (navView !== 'recent') {
      if (sortMode === 'recent') list.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
      else if (sortMode === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name));
      else if (sortMode === 'created') list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      else if (sortMode === 'speakers') list.sort((a, b) => b.speakers.length - a.speakers.length);
    }
    return list;
  }, [companies, navView, pinned, managerFilter, industryFilter, statusFilter, search, sortMode]);

  const loadData = async () => {
    const [companiesRes, speakersRes] = await Promise.all([
      supabase.from('companies').select('*').order('updated_at', { ascending: false }),
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
      industry: c.industry || null,
      archived_at: c.archived_at || null,
      updated_at: c.updated_at, created_at: c.created_at,
    })));
  };

  useEffect(() => { loadData(); }, []);

  const inferIndustries = async (companyIds?: string[], { silent = false } = {}) => {
    const targets = companyIds && companyIds.length
      ? companyIds
      : companies.filter(c => !c.archived_at && !c.industry).map(c => c.id);
    if (!targets.length) {
      if (!silent) toast({ title: 'All clients already categorized' });
      return;
    }
    setIsInferring(true);
    try {
      // Batch in chunks of 20 to keep prompt small
      const chunks: string[][] = [];
      for (let i = 0; i < targets.length; i += 20) chunks.push(targets.slice(i, i + 20));
      let total = 0;
      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke('infer-company-industries', { body: { company_ids: chunk } });
        if (error) throw error;
        total += (data?.results || []).length;
      }
      await loadData();
      if (!silent) toast({ title: 'Industries inferred', description: `${total} client${total === 1 ? '' : 's'} categorized.` });
    } catch (e) {
      if (!silent) toast({ title: 'Inference failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsInferring(false);
    }
  };

  // Auto-infer in background on first load (one-shot per session)
  const [autoInferred, setAutoInferred] = useState(false);
  useEffect(() => {
    if (autoInferred) return;
    const missing = companies.filter(c => !c.archived_at && !c.industry);
    if (missing.length === 0 || companies.length === 0) return;
    setAutoInferred(true);
    inferIndustries(missing.slice(0, 40).map(c => c.id), { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.length, autoInferred]);

  const toggleCompany = (id: string) => {
    setActiveCompanyId(prev => (prev === id ? null : id));
  };
  const openCompany = (id: string) => setActiveCompanyId(id);
  const closePanel = () => setActiveCompanyId(null);

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
      <main className="w-full px-4 lg:px-6 py-4">
        <ImportFromAirtableDialog open={showImportDialog} onOpenChange={setShowImportDialog} existingCompanies={companies.map(c => ({ id: c.id, name: c.name }))} onImportComplete={loadData} />

        <div className="flex gap-6 items-start">
          {/* ═══ Sidebar ═══ */}
          <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pr-1">
            {/* Primary actions */}
            <div className="flex flex-col gap-2 mb-5">
              <Button variant="hero" size="sm" className="justify-center h-9" onClick={startNewCompany}>
                <Plus className="h-4 w-4 mr-1.5" />New Client
              </Button>
              <Button variant="soft" size="sm" className="justify-center h-9" onClick={() => setShowImportDialog(true)}>
                <Download className="h-4 w-4 mr-1.5" />Import from Airtable
              </Button>
            </div>

            {/* Pinned */}
            {pinnedCount > 0 && (
              <div className="mb-5">
                <p className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Pinned</p>
                <nav className="flex flex-col gap-0.5">
                  {companies.filter(c => pinned.has(c.id) && !c.archived_at).slice(0, 8).map(c => (
                    <button key={c.id} onClick={() => { setNavView('all'); setSearch(c.name); }} className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/60 text-left">
                      <div className="w-5 h-5 rounded bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/40">
                        {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-contain p-0.5" /> : <Building2 className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <span className="text-sm truncate flex-1">{c.name}</span>
                      <Pin className="h-3 w-3 text-muted-foreground/60 fill-current" />
                    </button>
                  ))}
                </nav>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5 mb-5">
              {([
                { key: 'my', label: 'My Clients', icon: User },
                { key: 'all', label: 'All Clients', icon: Users },
                { key: 'recent', label: 'Recently Active', icon: Clock },
                { key: 'archived', label: 'Archived', icon: Archive, count: archivedCount },
              ] as const).map(item => {
                const Icon = item.icon;
                const active = navView === item.key;
                return (
                  <button key={item.key} onClick={() => setNavView(item.key)} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {'count' in item && item.count ? <span className="text-[11px] text-muted-foreground/70">{item.count}</span> : null}
                  </button>
                );
              })}
            </nav>

            {/* Campaign Managers */}
            {managers.length > 0 && (
              <div className="mb-5">
                <p className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Campaign Managers</p>
                <nav className="flex flex-col gap-0.5">
                  {managers.map(([name, count]) => {
                    const active = managerFilter === name;
                    return (
                      <button key={name} onClick={() => setManagerFilter(active ? '' : name)} className={`group flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                        <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px] bg-muted">{name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <span className="flex-1 truncate">{name}</span>
                        <span className="text-[11px] text-muted-foreground/60">{count}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Industries */}
            {industries.length > 0 && (
              <div className="mb-5">
                <p className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Industries</p>
                <nav className="flex flex-col gap-0.5">
                  {industries.slice(0, 12).map(([tag, count]) => {
                    const active = industryFilter === tag;
                    const s = industryStyle(tag);
                    return (
                      <button key={tag} onClick={() => setIndustryFilter(active ? '' : tag)} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.fg }} />
                        <span className="flex-1 truncate">{tag}</span>
                        <span className="text-[11px] text-muted-foreground/60">{count}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
          </aside>

          {/* ═══ Main content ═══ */}
          <section className="flex-1 min-w-0">
            {/* Page heading */}
            <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {navView === 'archived' ? 'Archived' : navView === 'recent' ? 'Recently Active' : navView === 'pinned' ? 'Pinned' : navView === 'my' ? 'My Clients' : 'All Clients'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">Browse and manage all your client campaigns.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="soft" size="sm" className="h-9" onClick={() => inferIndustries()} disabled={isInferring}>
                  {isInferring ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  {isInferring ? 'Categorizing…' : 'Auto-categorize'}
                </Button>
                <div className="flex items-center gap-1 p-0.5 rounded-md border border-border/60 bg-card">
                  <button onClick={() => setViewMode('list')} className={`h-7 w-8 flex items-center justify-center rounded ${viewMode === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`} title="List view"><List className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setViewMode('grid')} className={`h-7 w-8 flex items-center justify-center rounded ${viewMode === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`} title="Grid view"><LayoutGrid className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients, speakers, industries…" className="h-9 pl-9 bg-card" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="soft" size="sm" className="h-9">
                    Campaign Manager{managerFilter ? `: ${managerFilter}` : ''}
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setManagerFilter('')}>All managers</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {managers.map(([name, count]) => (
                    <DropdownMenuCheckboxItem key={name} checked={managerFilter === name} onCheckedChange={() => setManagerFilter(managerFilter === name ? '' : name)}>
                      {name} <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="soft" size="sm" className="h-9">
                    Industry{industryFilter ? `: ${industryFilter}` : ''}
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setIndustryFilter('')}>All industries</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {industries.map(([tag, count]) => (
                    <DropdownMenuCheckboxItem key={tag} checked={industryFilter === tag} onCheckedChange={() => setIndustryFilter(industryFilter === tag ? '' : tag)}>
                      {tag} <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="soft" size="sm" className="h-9">
                    Status{statusFilter !== 'all' ? `: ${statusFilter === 'with_speakers' ? 'With speakers' : 'No speakers'}` : ''}
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem checked={statusFilter === 'all'} onCheckedChange={() => setStatusFilter('all')}>All</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={statusFilter === 'with_speakers'} onCheckedChange={() => setStatusFilter('with_speakers')}>With speakers</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={statusFilter === 'no_speakers'} onCheckedChange={() => setStatusFilter('no_speakers')}>No speakers</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="soft" size="sm" className="h-9">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                    {sortMode === 'recent' ? 'Recently Active' : sortMode === 'alpha' ? 'Alphabetical' : sortMode === 'created' ? 'Recently Added' : 'Most Speakers'}
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem checked={sortMode === 'recent'} onCheckedChange={() => setSortMode('recent')}>Recently Active</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={sortMode === 'alpha'} onCheckedChange={() => setSortMode('alpha')}>Alphabetical</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={sortMode === 'created'} onCheckedChange={() => setSortMode('created')}>Recently Added</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={sortMode === 'speakers'} onCheckedChange={() => setSortMode('speakers')}>Most Speakers</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Result count + active filter chips */}
            <div className="flex items-center gap-2 mb-3 flex-wrap text-xs text-muted-foreground">
              <span>{filtered.length} {filtered.length === 1 ? 'client' : 'clients'}</span>
              {(managerFilter || industryFilter || statusFilter !== 'all' || search) && (
                <>
                  <span className="text-border">·</span>
                  {managerFilter && (
                    <button onClick={() => setManagerFilter('')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground hover:bg-secondary/80">
                      CM: {managerFilter} <X className="h-3 w-3" />
                    </button>
                  )}
                  {industryFilter && (
                    <button onClick={() => setIndustryFilter('')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground hover:bg-secondary/80">
                      {industryFilter} <X className="h-3 w-3" />
                    </button>
                  )}
                  {statusFilter !== 'all' && (
                    <button onClick={() => setStatusFilter('all')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground hover:bg-secondary/80">
                      {statusFilter === 'with_speakers' ? 'With speakers' : 'No speakers'} <X className="h-3 w-3" />
                    </button>
                  )}
                  {search && (
                    <button onClick={() => setSearch('')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground hover:bg-secondary/80">
                      "{search}" <X className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Directory list */}
            <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
              {/* Header row */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_180px_140px_40px] gap-4 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                <div>Client</div>
                <div>Speaker(s)</div>
                <div>Industry</div>
                <div>Recent Activity</div>
                <div />
              </div>

              {filtered.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  {navView === 'archived' ? 'No archived clients.' : 'No clients match your filters.'}
                </div>
              ) : (
                <div className="px-2 pb-2">
                  {filtered.map(company => {
                    const expanded = expandedCompanies.has(company.id);
                    const isPinned = pinned.has(company.id);
                    const ind = company.industry;
                    const indStyle = industryStyle(ind);
                    return (
                      <div key={company.id} className="mb-1 last:mb-0">
                        {/* Row */}
                        <div
                          className="group grid grid-cols-[1fr_1fr_180px_140px_40px] gap-4 items-center px-3 py-3 rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors"
                          onClick={() => toggleCompany(company.id)}
                        >
                          {/* Client */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-md bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/40">
                              {company.logo_url ? (
                                <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex items-center gap-1.5">
                              <span className="font-medium text-[15px] truncate">{company.name}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); togglePin(company.id); }}
                                className={`shrink-0 p-1 rounded transition-opacity ${isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}`}
                                title={isPinned ? 'Unpin' : 'Pin'}
                              >
                                {isPinned ? <Pin className="h-3 w-3 fill-current" /> : <Pin className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Speakers */}
                          <div className="flex items-center gap-2 min-w-0">
                            {company.speakers.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">No speakers</span>
                            ) : (
                              <>
                                <div className="flex items-center -space-x-2">
                                  {company.speakers.slice(0, 2).map(s => (
                                    <Avatar key={s.id} className="w-6 h-6 ring-2 ring-card">
                                      <AvatarImage src={s.headshot_url || undefined} alt={s.name} />
                                      <AvatarFallback className="text-[9px] bg-muted">{s.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                                <span className="text-sm truncate">
                                  {company.speakers[0].name}
                                  {company.speakers.length > 1 && <span className="text-muted-foreground"> +{company.speakers.length - 1}</span>}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Industry */}
                          <div className="min-w-0">
                            {ind ? (
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border"
                                style={{ backgroundColor: indStyle.bg, color: indStyle.fg, borderColor: indStyle.ring }}
                              >
                                {ind}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] text-muted-foreground/70 italic">
                                {isInferring ? 'Categorizing…' : 'Uncategorized'}
                              </span>
                            )}
                          </div>

                          {/* Recent Activity */}
                          <div className="text-xs text-muted-foreground">
                            {relativeTime(company.updated_at || company.created_at)}
                          </div>

                          {/* Chevron */}
                          <div className="text-muted-foreground flex justify-end">
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                        </div>

                        {/* Expanded panel */}
                        {expanded && (
                          <div className="bg-muted/10 border-t border-border/40">
                            {/* Action bar */}
                            <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30">
                              {!company.archived_at && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startNewSpeaker(company.id)}>
                                    <Plus className="h-3.5 w-3.5 mr-1" />Speaker
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAirtableDialog({ companyId: company.id, entityName: company.name })}>
                                    <Link2 className="h-3.5 w-3.5 mr-1" />Airtable
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEditCompany(company)}>
                                    <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAeoHistoryFor({ id: company.id, name: company.name })}>
                                    <History className="h-3.5 w-3.5 mr-1" />AEO History
                                  </Button>
                                </>
                              )}
                              <div className="flex-1" />
                              {company.archived_at ? (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => restoreCompany(company.id)}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Restore
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => archiveCompany(company.id)}>
                                  <Archive className="h-3.5 w-3.5 mr-1" />Archive
                                </Button>
                              )}
                              {!company.archived_at && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive">
                                      <Trash className="h-3.5 w-3.5 mr-1" />Delete
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete client?</AlertDialogTitle>
                                      <AlertDialogDescription>This will permanently remove {company.name} and all its speakers.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => removeCompany(company.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>

                            {/* Speaker list */}
                            <div className="divide-y divide-border/30 px-2">
                              {company.speakers.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">No speakers yet. Add one to get started.</p>
                              ) : (
                                company.speakers.map(speaker => (
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
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
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

        {/* AEO Audit History Panel */}
        <AEOAuditHistory
          open={!!aeoHistoryFor}
          onOpenChange={(open) => !open && setAeoHistoryFor(null)}
          companyId={aeoHistoryFor?.id ?? ''}
          companyName={aeoHistoryFor?.name ?? ''}
        />
      </main>
    </div>
  );
};

export default Companies;
