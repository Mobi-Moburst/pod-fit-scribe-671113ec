import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Company, Speaker, Competitor } from '@/types/clients';
import { useToast } from '@/components/ui/use-toast';
import { parseCampaignStrategy, pickTopAudienceTags } from '@/lib/campaignStrategy';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import { Trash, Sparkles, Loader2, Plus, X, ChevronDown, ChevronRight, Building2, User, Globe, ImageIcon, Pencil, Check, Upload, Link2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AirtableConnectionDialog } from '@/components/airtable/AirtableConnectionDialog';

// Deterministic color classes for CM badge using design tokens
const cmColor = (name?: string) => {
  if (!name) return "bg-muted/50 text-muted-foreground border-muted";
  const palette = [
    "bg-primary text-primary-foreground border-transparent",
    "bg-secondary text-secondary-foreground border-transparent",
    "bg-accent text-accent-foreground border-transparent",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
};

const emptyCompany: Omit<Company, 'id'> = {
  name: '',
  company_url: '',
  logo_url: '',
  brand_colors: undefined,
  campaign_manager: '',
  airtable_embed_url: '',
  product_type: '',
  tags: [],
  notes: '',
};

const emptySpeaker: Omit<Speaker, 'id' | 'company_id'> = {
  name: '',
  title: '',
  headshot_url: '',
  media_kit_url: '',
  airtable_embed_url: '',
  gender: undefined,
  target_audiences: [],
  talking_points: [],
  avoid: [],
  guest_identity_tags: [],
  professional_credentials: [],
  campaign_strategy: '',
  pitch_template: '',
  competitors: [],
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
  const [isSuggestingCompetitors, setIsSuggestingCompetitors] = useState(false);
  const [isFetchingBrand, setIsFetchingBrand] = useState(false);
  const [showManualLogoInput, setShowManualLogoInput] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [airtableDialog, setAirtableDialog] = useState<{ companyId?: string; speakerId?: string; entityName: string } | null>(null);
  const { toast } = useToast();

  const fetchCompanyBrand = async () => {
    if (!editingCompany?.company_url) {
      toast({ title: 'Enter a company URL first', variant: 'destructive' });
      return;
    }
    setIsFetchingBrand(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-company-brand', {
        body: { url: editingCompany.company_url }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch brand');
      
      let updated = { ...editingCompany };
      if (data.logo_url) {
        updated.logo_url = data.logo_url;
        setShowManualLogoInput(false);
        setLogoError(false);
      }
      if (data.brand_colors) {
        updated.brand_colors = data.brand_colors;
      }
      if (data.logo_url || data.brand_colors) {
        toast({ title: 'Brand fetched', description: data.logo_url ? 'Logo and colors loaded.' : 'Brand colors loaded.' });
      } else {
        toast({ title: 'No branding found', description: 'Could not extract branding from this URL.', variant: 'destructive' });
      }
      setEditingCompany(updated);
    } catch (error) {
      console.error('Failed to fetch brand:', error);
      toast({ title: 'Failed to fetch brand', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsFetchingBrand(false);
    }
  };

  const managers = useMemo(() => Array.from(new Set(
    companies.map((c) => (c.campaign_manager || '').trim()).filter(Boolean)
  )).sort(), [companies]);

  const filtered = useMemo(() => companies.filter((c) => 
    !managerFilter || (c.campaign_manager || '').trim() === managerFilter
  ), [companies, managerFilter]);

  const loadData = async () => {
    const [companiesRes, speakersRes] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('speakers').select('*').order('created_at', { ascending: false }),
    ]);

    if (companiesRes.error) {
      console.error(companiesRes.error);
      toast({ title: 'Error', description: 'Failed to load companies.', variant: 'destructive' });
      return;
    }

    const speakersMap = new Map<string, Speaker[]>();
    (speakersRes.data || []).forEach((s: any) => {
      const speaker: Speaker = {
        id: s.id,
        company_id: s.company_id,
        name: s.name,
        title: s.title || '',
        headshot_url: s.headshot_url || '',
        media_kit_url: s.media_kit_url || '',
        airtable_embed_url: s.airtable_embed_url || '',
        gender: s.gender,
        target_audiences: s.target_audiences || [],
        talking_points: s.talking_points || [],
        avoid: s.avoid || [],
        guest_identity_tags: s.guest_identity_tags || [],
        professional_credentials: s.professional_credentials || [],
        campaign_strategy: s.campaign_strategy || '',
        pitch_template: s.pitch_template || '',
        competitors: s.competitors || [],
      };
      const existing = speakersMap.get(s.company_id) || [];
      existing.push(speaker);
      speakersMap.set(s.company_id, existing);
    });

    setCompanies((companiesRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      company_url: c.company_url || '',
      logo_url: c.logo_url || '',
      brand_colors: c.brand_colors || undefined,
      campaign_manager: c.campaign_manager || '',
      airtable_embed_url: c.airtable_embed_url || '',
      product_type: c.product_type || '',
      tags: c.tags || [],
      notes: c.notes || '',
      speakers: speakersMap.get(c.id) || [],
    })));
  };

  useEffect(() => { loadData(); }, []);

  const toggleCompany = (id: string) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Company CRUD
  const startNewCompany = () => {
    setEditingCompany({ ...emptyCompany, id: crypto.randomUUID(), isNew: true });
    setShowManualLogoInput(false);
    setLogoError(false);
  };
  const startEditCompany = (c: Company) => {
    setEditingCompany({ ...c });
    setShowManualLogoInput(false);
    setLogoError(false);
  };
  const cancelCompany = () => setEditingCompany(null);

  const canSaveCompany = useMemo(() => {
    if (!editingCompany) return false;
    return editingCompany.name.trim().length > 0;
  }, [editingCompany]);

  const saveCompany = async () => {
    if (!editingCompany || !canSaveCompany) return;
    const isNew = editingCompany.isNew;
    const payload = {
      name: editingCompany.name.trim(),
      company_url: editingCompany.company_url?.trim() || null,
      logo_url: editingCompany.logo_url?.trim() || null,
      brand_colors: (editingCompany.brand_colors || null) as any,
      campaign_manager: editingCompany.campaign_manager?.trim() || null,
      airtable_embed_url: editingCompany.airtable_embed_url?.trim() || null,
      product_type: editingCompany.product_type?.trim() || '',
      tags: editingCompany.tags || [],
      notes: editingCompany.notes?.trim() || '',
    };

    if (isNew) {
      const { error } = await supabase.from('companies').insert([
        { id: editingCompany.id, org_id: TEAM_ORG_ID, ...payload }
      ]);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase.from('companies').update(payload).eq('id', editingCompany.id);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
    }

    setEditingCompany(null);
    await loadData();
    toast({ title: 'Company saved' });
  };

  const removeCompany = async (id: string) => {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    await loadData();
  };

  // Speaker CRUD
  const startNewSpeaker = (companyId: string) => {
    setEditingSpeaker({ ...emptySpeaker, id: crypto.randomUUID(), company_id: companyId, isNew: true, avoid_text: '' });
    setExpandedCompanies(prev => new Set(prev).add(companyId));
  };
  
  const startEditSpeaker = (s: Speaker) => {
    setEditingSpeaker({ ...s, avoid_text: (s.avoid || []).join(', ') });
  };
  
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
      company_id: editingSpeaker.company_id,
      name: editingSpeaker.name.trim(),
      title: editingSpeaker.title?.trim() || null,
      headshot_url: editingSpeaker.headshot_url?.trim() || null,
      media_kit_url: editingSpeaker.media_kit_url?.trim() || '',
      airtable_embed_url: editingSpeaker.airtable_embed_url?.trim() || null,
      gender: editingSpeaker.gender || null,
      target_audiences: editingSpeaker.target_audiences || [],
      talking_points: editingSpeaker.talking_points || [],
      avoid: editingSpeaker.avoid || [],
      guest_identity_tags: editingSpeaker.guest_identity_tags || [],
      professional_credentials: editingSpeaker.professional_credentials || [],
      campaign_strategy: editingSpeaker.campaign_strategy?.trim() || '',
      pitch_template: editingSpeaker.pitch_template?.trim() || null,
      competitors: (editingSpeaker.competitors || []) as any,
    };

    if (isNew) {
      const { error } = await supabase.from('speakers').insert([
        { id: editingSpeaker.id, org_id: TEAM_ORG_ID, ...payload } as any
      ]);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase.from('speakers').update(payload as any).eq('id', editingSpeaker.id);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
    }

    setEditingSpeaker(null);
    await loadData();
    toast({ title: 'Speaker saved' });
  };

  const removeSpeaker = async (id: string) => {
    const { error } = await supabase.from('speakers').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    await loadData();
  };

  // Competitor helpers
  const suggestCompetitors = async () => {
    if (!editingSpeaker) return;
    setIsSuggestingCompetitors(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-competitors', {
        body: { client: editingSpeaker }
      });
      if (error) throw error;
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        setEditingSpeaker({
          ...editingSpeaker,
          competitors: data.suggestions.map((s: any) => ({
            name: s.name,
            role: s.role,
            peer_reason: s.peer_reason,
          }))
        });
        toast({ title: 'Competitors suggested', description: `AI identified ${data.suggestions.length} peer thought leaders.` });
      }
    } catch (error) {
      console.error('Failed to suggest competitors:', error);
      toast({ title: 'Failed to suggest competitors', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSuggestingCompetitors(false);
    }
  };

  const addCompetitor = () => {
    if (!editingSpeaker) return;
    setEditingSpeaker({
      ...editingSpeaker,
      competitors: [...(editingSpeaker.competitors || []), { name: '', role: '', peer_reason: '' }]
    });
  };

  const updateCompetitor = (index: number, field: keyof Competitor, value: string) => {
    if (!editingSpeaker) return;
    const updated = [...(editingSpeaker.competitors || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditingSpeaker({ ...editingSpeaker, competitors: updated });
  };

  const removeCompetitor = (index: number) => {
    if (!editingSpeaker) return;
    setEditingSpeaker({
      ...editingSpeaker,
      competitors: (editingSpeaker.competitors || []).filter((_, i) => i !== index)
    });
  };

  const toList = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        {/* Header */}
        <Card className="p-4 card-surface flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Companies</h1>
            <p className="text-sm text-muted-foreground">Manage companies and their speakers for podcast campaigns.</p>
          </div>
          <Button variant="hero" onClick={startNewCompany}>
            <Building2 className="h-4 w-4 mr-2" />
            New Company
          </Button>
        </Card>

        {/* Company Edit Form */}
        {editingCompany && (
          <Card className="p-4 card-surface grid gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editingCompany.isNew ? 'New Company' : 'Edit Company'}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1">Name <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="Acme Inc."
                  value={editingCompany.name} 
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className={editingCompany.name.trim() ? 'border-green-500/50' : ''}
                />
              </div>
              <div>
                <Label>Campaign Manager</Label>
                <Input 
                  placeholder="e.g., Troy"
                  value={editingCompany.campaign_manager || ''} 
                  onChange={(e) => setEditingCompany({ ...editingCompany, campaign_manager: e.target.value })}
                />
              </div>
              <div>
                <Label>Company URL</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="https://acme.com"
                    value={editingCompany.company_url || ''} 
                    onChange={(e) => setEditingCompany({ ...editingCompany, company_url: e.target.value })}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={fetchCompanyBrand}
                    disabled={isFetchingBrand || !editingCompany.company_url?.trim()}
                    title="Fetch logo from website"
                  >
                    {isFetchingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Company Logo</Label>
                {editingCompany.logo_url && !logoError ? (
                  <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                    <img 
                      src={editingCompany.logo_url} 
                      alt="Company logo" 
                      className="w-10 h-10 rounded object-contain bg-background"
                      onError={() => setLogoError(true)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" /> Logo loaded
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowManualLogoInput(!showManualLogoInput)}
                        title="Edit URL"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingCompany({ ...editingCompany, logo_url: '' });
                          setLogoError(false);
                        }}
                        title="Remove logo"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-md border border-dashed border-border bg-muted/20">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      {logoError ? (
                        <p className="text-sm text-destructive">Failed to load logo</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No logo</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={fetchCompanyBrand}
                        disabled={isFetchingBrand || !editingCompany.company_url?.trim()}
                      >
                        {isFetchingBrand ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                        Fetch
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowManualLogoInput(true)}
                      >
                        Enter URL
                      </Button>
                    </div>
                  </div>
                )}
                {showManualLogoInput && (
                  <div className="flex gap-2 mt-2">
                    <Input 
                      placeholder="https://acme.com/logo.png"
                      value={editingCompany.logo_url || ''} 
                      onChange={(e) => {
                        setEditingCompany({ ...editingCompany, logo_url: e.target.value });
                        setLogoError(false);
                      }}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowManualLogoInput(false)}
                    >
                      Done
                    </Button>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <Label>Airtable View URL</Label>
                <Input 
                  placeholder="https://airtable.com/app.../shr..."
                  value={editingCompany.airtable_embed_url || ''} 
                  onChange={(e) => setEditingCompany({ ...editingCompany, airtable_embed_url: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  placeholder="Internal notes about this company..."
                  value={editingCompany.notes || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelCompany}>Cancel</Button>
              <Button variant="hero" onClick={saveCompany} disabled={!canSaveCompany}>Save Company</Button>
            </div>
          </Card>
        )}

        {/* Speaker Edit Form */}
        {editingSpeaker && (
          <Card className="p-4 card-surface grid gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              {editingSpeaker.isNew ? 'New Speaker' : 'Edit Speaker'}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1">Name <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="John Doe"
                  value={editingSpeaker.name} 
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, name: e.target.value })}
                  className={editingSpeaker.name.trim() ? 'border-green-500/50' : ''}
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input 
                  placeholder="e.g., CEO & Founder"
                  value={editingSpeaker.title || ''} 
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Gender</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={editingSpeaker.gender || ''}
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, gender: e.target.value as any })}
                >
                  <option value="">Prefer not to specify</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="unspecified">Unspecified</option>
                </select>
              </div>
              <div>
                <Label className="flex items-center gap-1">Media Kit URL <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="https://..."
                  value={editingSpeaker.media_kit_url || ''} 
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, media_kit_url: e.target.value })}
                  className={editingSpeaker.media_kit_url && /^https?:\/\/.+/.test(editingSpeaker.media_kit_url.trim()) ? 'border-green-500/50' : ''}
                />
              </div>
              <div>
                <Label>Headshot</Label>
                <div className="flex items-center gap-4 mt-2">
                  {editingSpeaker.headshot_url ? (
                    <div className="relative group">
                      <img 
                        src={editingSpeaker.headshot_url} 
                        alt="Speaker headshot" 
                        className="w-20 h-20 rounded-full object-cover border-2 border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingSpeaker({ ...editingSpeaker, headshot_url: '' })}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="headshot-upload"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${editingSpeaker.id || crypto.randomUUID()}-${Date.now()}.${fileExt}`;
                        
                        const { data, error } = await supabase.storage
                          .from('speaker-headshots')
                          .upload(fileName, file, { upsert: true });
                        
                        if (error) {
                          toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                          return;
                        }
                        
                        const { data: { publicUrl } } = supabase.storage
                          .from('speaker-headshots')
                          .getPublicUrl(fileName);
                        
                        setEditingSpeaker({ ...editingSpeaker, headshot_url: publicUrl });
                        toast({ title: 'Headshot uploaded!' });
                      }}
                    />
                    <label
                      htmlFor="headshot-upload"
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {editingSpeaker.headshot_url ? 'Change Photo' : 'Upload Photo'}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">Square image recommended (JPG, PNG)</p>
                  </div>
                </div>
              </div>
              <div>
                <Label>Airtable Embed URL</Label>
                <Input 
                  placeholder="https://airtable.com/..."
                  value={editingSpeaker.airtable_embed_url || ''} 
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, airtable_embed_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Speaker-specific Airtable (optional, falls back to company Airtable)</p>
              </div>
              <div className="md:col-span-2">
                <Label className="flex items-center gap-1">Campaign Strategy <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={10}
                  placeholder={`Target Audiences:\n- Founders & Startup Leaders – Entrepreneurs looking to ...\n\nTalking Points That Will Land:\n- The Future of Meeting Productivity – How AI-powered tools ...`}
                  value={editingSpeaker.campaign_strategy || ''}
                  onChange={(e) => {
                    const campaign_strategy = e.target.value;
                    const { audiences, talking } = parseCampaignStrategy(campaign_strategy);
                    setEditingSpeaker({
                      ...editingSpeaker,
                      campaign_strategy,
                      target_audiences: audiences,
                      talking_points: talking,
                    });
                  }}
                  className={(editingSpeaker.campaign_strategy || '').trim() ? 'border-green-500/50' : ''}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Things to Avoid</Label>
                <Textarea
                  rows={3}
                  placeholder="crypto, MLM, NFT"
                  value={editingSpeaker.avoid_text || ''}
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, avoid_text: e.target.value, avoid: toList(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Guest Identity Tags</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g., woman_entrepreneur, black_founder, veteran"
                  value={(editingSpeaker.guest_identity_tags || []).join(', ')}
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, guest_identity_tags: toList(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Custom Pitch Template (Optional)</Label>
                <Textarea
                  rows={8}
                  placeholder={`Hey [host_first_name],\n\nI'd like to recommend a guest to [podcast_name]...`}
                  value={editingSpeaker.pitch_template || ''}
                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, pitch_template: e.target.value })}
                />
              </div>
              
              {/* Competitors Section */}
              <div className="md:col-span-2 border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base">Competitors / Peer Thought Leaders</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Identify 2-3 peers who compete for share-of-voice
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={suggestCompetitors} disabled={isSuggestingCompetitors || !editingSpeaker.name}>
                    {isSuggestingCompetitors ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suggesting...</> : <><Sparkles className="h-4 w-4 mr-2" />Suggest with AI</>}
                  </Button>
                </div>
                {editingSpeaker.competitors && editingSpeaker.competitors.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {editingSpeaker.competitors.map((comp, idx) => (
                      <Card key={idx} className="p-4 bg-muted/30">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className="text-sm font-medium text-muted-foreground">Competitor {idx + 1}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCompetitor(idx)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Name</Label>
                              <Input placeholder="John Smith" value={comp.name} onChange={(e) => updateCompetitor(idx, 'name', e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">Role & Company</Label>
                              <Input placeholder="CEO, Acme Corp" value={comp.role} onChange={(e) => updateCompetitor(idx, 'role', e.target.value)} />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">LinkedIn URL</Label>
                            <Input placeholder="https://linkedin.com/in/johnsmith" value={comp.linkedin_url || ''} onChange={(e) => updateCompetitor(idx, 'linkedin_url', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Why are they a peer competitor?</Label>
                            <Textarea rows={2} placeholder="Competes for share-of-voice..." value={comp.peer_reason} onChange={(e) => updateCompetitor(idx, 'peer_reason', e.target.value)} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addCompetitor}><Plus className="h-4 w-4 mr-2" />Add Competitor</Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelSpeaker}>Cancel</Button>
              <Button variant="hero" onClick={saveSpeaker} disabled={!canSaveSpeaker}>Save Speaker</Button>
            </div>
          </Card>
        )}

        {/* Filter */}
        <Card className="p-4 card-surface">
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-sm">Campaign Manager</Label>
            <select className="h-9 rounded-md border bg-background px-3" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
              <option value="">All</option>
              {managers.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>

          {/* Companies List */}
          <div className="grid gap-3">
            {filtered.map(company => (
              <Collapsible key={company.id} open={expandedCompanies.has(company.id)} onOpenChange={() => toggleCompany(company.id)}>
                <div className="border border-border rounded-lg overflow-hidden">
                  {/* Company Header */}
                  <div className="flex items-center justify-between p-4 bg-muted/30">
                    <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                      {expandedCompanies.has(company.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {company.company_url ? (
                            <a href={company.company_url} target="_blank" rel="noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()}>{company.name}</a>
                          ) : company.name}
                          <Badge variant="secondary" className="text-xs">{company.speakers.length} speaker{company.speakers.length !== 1 ? 's' : ''}</Badge>
                        </div>
                        {company.campaign_manager && (
                          <Badge variant="default" className={`mt-1 ${cmColor(company.campaign_manager)}`}>CM: {company.campaign_manager}</Badge>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={(e) => { e.stopPropagation(); setAirtableDialog({ companyId: company.id, entityName: company.name }); }}
                        title="Connect Airtable API"
                      >
                        <Link2 className="h-4 w-4 mr-1" />Airtable
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startNewSpeaker(company.id); }}>
                        <Plus className="h-4 w-4 mr-1" />Speaker
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEditCompany(company); }}>Edit</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}><Trash className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete company?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove {company.name} and all its speakers. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeCompany(company.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Speakers List */}
                  <CollapsibleContent>
                    <div className="border-t border-border">
                      {company.speakers.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">No speakers yet. Add one to get started.</div>
                      ) : (
                        company.speakers.map(speaker => (
                          <div key={speaker.id} className="flex items-center justify-between p-4 border-b border-border/50 last:border-b-0 hover:bg-muted/20">
                            <div className="flex items-center gap-3">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {speaker.media_kit_url ? (
                                    <a href={speaker.media_kit_url} target="_blank" rel="noreferrer" className="hover:underline">{speaker.name}</a>
                                  ) : speaker.name}
                                  {speaker.title && <span className="text-muted-foreground ml-2">— {speaker.title}</span>}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {pickTopAudienceTags({ strategyText: speaker.campaign_strategy || '', audiences: speaker.target_audiences || [], max: 3 }).map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => setAirtableDialog({ companyId: company.id, speakerId: speaker.id, entityName: speaker.name })}
                                title="Connect Airtable API"
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => startEditSpeaker(speaker)}>Edit</Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost"><Trash className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete speaker?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove {speaker.name}. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeSpeaker(speaker.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
            {!filtered.length && <div className="text-sm text-muted-foreground">No companies yet.</div>}
          </div>
        </Card>

        {/* Airtable Connection Dialog */}
        <AirtableConnectionDialog
          open={!!airtableDialog}
          onOpenChange={(open) => !open && setAirtableDialog(null)}
          companyId={airtableDialog?.companyId}
          speakerId={airtableDialog?.speakerId}
          entityName={airtableDialog?.entityName || ''}
        />
      </main>
    </div>
  );
};

export default Companies;
