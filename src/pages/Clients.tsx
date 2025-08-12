
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { MinimalClient } from '@/types/clients';
import { getClients, toList } from '@/data/clientStore';
import { useToast } from '@/components/ui/use-toast';
import { parseCampaignStrategy, pickTopAudienceTags } from '@/lib/campaignStrategy';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';

const empty: MinimalClient = {
  id: '',
  name: '',
  media_kit_url: '',
  company: '',
  target_audiences: [],
  talking_points: [],
  avoid: [],
  avoid_text: '',
  notes: '',
  campaign_strategy: '', // keep for backward compatibility
  campaign_manager: '',
};

const Clients = () => {
  useEffect(() => { document.title = 'Clients — Podcast Fit Rater'; }, []);
  const [list, setList] = useState<MinimalClient[]>([]);
  const [editing, setEditing] = useState<MinimalClient | null>(null);
  const [managerFilter, setManagerFilter] = useState<string>('');
  const { toast } = useToast();

  const managers = useMemo(() => Array.from(new Set((list || [])
    .map((c: any) => (c.campaign_manager || '').trim())
    .filter(Boolean))).sort(), [list]);

  const filtered = useMemo(() => (list || []).filter((c: any) => !managerFilter || ((c.campaign_manager || '').trim() === managerFilter)), [list, managerFilter]);

  const loadClients = async () => {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load clients.' , variant: 'destructive'});
      return;
    }
    setList((data || []).map((c: any) => ({
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
    })));
  };

  useEffect(() => {
    (async () => {
      // One-time migration from local storage if cloud is empty
      const { data: existing } = await supabase.from('clients').select('id').limit(1);
      if (!existing || existing.length === 0) {
        const local = getClients();
        if (local.length) {
          const payload = local.map((l) => ({
            id: l.id,
            org_id: TEAM_ORG_ID,
            name: l.name,
            company: l.company || null,
            media_kit_url: l.media_kit_url || '',
            target_audiences: l.target_audiences || [],
            talking_points: l.talking_points || [],
            avoid: l.avoid || [],
            notes: l.notes || null,
            campaign_strategy: l.campaign_strategy || '',
            campaign_manager: 'Troy',
          }));
          const { error: upErr } = await supabase.from('clients').upsert(payload, { onConflict: 'id' });
          if (upErr) {
            console.error('Migration failed', upErr);
          } else {
            toast({ title: 'Migrated', description: 'Local clients moved to shared workspace.' });
          }
        }
      }
      await loadClients();
    })();
  }, []);

  const startNew = () => setEditing({ ...empty, id: crypto.randomUUID() });
  const startEdit = (c: MinimalClient) => setEditing({ ...empty, ...c, target_audiences: c.target_audiences || [], talking_points: c.talking_points || [], avoid: c.avoid || [], notes: c.notes || '' });
  const cancel = () => setEditing(null);

  const canSave = useMemo(() => !!editing && editing.name.trim().length > 0, [editing]);

  const save = async () => {
    if (!editing || !canSave) return;
    const exists = list.find((l) => l.id === editing.id);

    if (!exists) {
      const { error } = await supabase.from('clients').insert([
        {
          id: editing.id,
          org_id: TEAM_ORG_ID,
          name: editing.name,
          company: editing.company || null,
          media_kit_url: editing.media_kit_url || '',
          target_audiences: editing.target_audiences || [],
          talking_points: editing.talking_points || [],
          avoid: editing.avoid || [],
          notes: editing.notes || null,
          campaign_strategy: editing.campaign_strategy || '',
          campaign_manager: (editing as any).campaign_manager || null,
        } as any,
      ]);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase.from('clients').update({
        name: editing.name,
        company: editing.company || null,
        media_kit_url: editing.media_kit_url || '',
        target_audiences: editing.target_audiences || [],
        talking_points: editing.talking_points || [],
        avoid: editing.avoid || [],
        notes: editing.notes || null,
        campaign_strategy: editing.campaign_strategy || '',
        campaign_manager: (editing as any).campaign_manager || null,
      }).eq('id', editing.id);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
    }

    setEditing(null);
    await loadClients();
    toast({ title: 'Client saved', description: 'Saved to team workspace.' });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    await loadClients();
  };

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        <Card className="p-4 card-surface flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Clients</h1>
            <p className="text-sm text-muted-foreground">Add client details and paste the campaign strategy; we’ll parse it and handle the rest.</p>
          </div>
          <Button variant="hero" onClick={startNew}>New Client</Button>
        </Card>

        {editing && (
          <Card className="p-4 card-surface grid gap-4">
            <h2 className="text-lg font-semibold">{editing.id ? 'Edit Client' : 'New Client'}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Company</Label>
                <Input placeholder="Acme Inc." value={editing.company || ''} onChange={(e) => setEditing({ ...editing, company: e.target.value })} />
              </div>
              <div>
                <Label>Media Kit URL</Label>
                <Input placeholder="https://..." value={editing.media_kit_url} onChange={(e) => setEditing({ ...editing, media_kit_url: e.target.value })} />
              </div>
              <div>
                <Label>Campaign Manager</Label>
                <Input placeholder="e.g., Troy" value={(editing as any).campaign_manager || ''} onChange={(e) => setEditing({ ...editing, campaign_manager: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Campaign strategy</Label>
                <Textarea
                  rows={10}
                  placeholder={`Target Audiences:\n- Founders & Startup Leaders – Entrepreneurs looking to ...\n- Sales & Customer Success Leaders – Professionals focused on ...\n\nTalking Points That Will Land:\n- The Future of Meeting Productivity – How AI-powered tools ...\n- Turning Conversations into Action – How recording, transcribing ...`}
                  value={editing.campaign_strategy || ''}
                  onChange={(e) => {
                    const campaign_strategy = e.target.value;
                    const { audiences, talking } = parseCampaignStrategy(campaign_strategy);
                    setEditing({
                      ...editing,
                      campaign_strategy,
                      target_audiences: audiences,
                      talking_points: talking,
                    });
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Things to Avoid</Label>
                <Textarea
                  rows={4}
                  placeholder="crypto, MLM, NFT, Competitor: Duo"
                  value={editing.avoid_text || ''}
                  onChange={(e) => setEditing({ ...editing, avoid_text: e.target.value, avoid: toList(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Additional Notes</Label>
                <Textarea
                  rows={4}
                  placeholder="Authoritative, technical; no pay-to-play; prefers interview format."
                  value={editing.notes || ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancel}>Cancel</Button>
              <Button variant="hero" onClick={save} disabled={!canSave}>Save</Button>
            </div>
          </Card>
        )}

        <Card className="p-4 card-surface">
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-sm">Campaign Manager</Label>
            <select className="h-9 rounded-md border bg-background px-3" value={managerFilter} onChange={(e)=>setManagerFilter(e.target.value)}>
              <option value="">All</option>
              {managers.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div className="grid gap-2">
            {filtered.map(c => (
              <div key={c.id} className="grid grid-cols-12 gap-3 items-center border-b border-border/60 py-3">
                <div className="col-span-3 font-medium truncate">
                  {c.media_kit_url ? (
                    <a className="underline-offset-2 hover:underline" href={c.media_kit_url} target="_blank" rel="noreferrer">{c.name}</a>
                  ) : c.name}
                  {c.company && <span className="ml-2 text-sm text-muted-foreground">— {c.company}</span>}
                  <Badge variant="outline" className="ml-2 shrink-0">{c.campaign_manager ? `CM: ${c.campaign_manager}` : 'Unassigned'}</Badge>
                </div>
                <div className="col-span-7 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const top = pickTopAudienceTags({
                        strategyText: c.campaign_strategy || '',
                        audiences: c.target_audiences || [],
                        max: 3,
                      });
                      return top.length
                        ? top.map((tag) => (
                            <Badge key={tag} variant="secondary" className="shrink-0">{tag}</Badge>
                          ))
                        : <span className="opacity-70">—</span>;
                    })()}
                  </div>
                </div>
                <div className="flex justify-end gap-2 col-span-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(c.id)}>Delete</Button>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="text-sm text-muted-foreground">No clients yet.</div>}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Clients;
