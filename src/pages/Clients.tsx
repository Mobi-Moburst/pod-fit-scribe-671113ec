
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
import { getClients, saveClients, toList } from '@/data/clientStore';
import { useToast } from '@/components/ui/use-toast';
import { parseCampaignStrategy, pickTopAudienceTags } from '@/lib/campaignStrategy';

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
};

const Clients = () => {
  useEffect(() => { document.title = 'Clients — Podcast Fit Rater'; }, []);
  const [list, setList] = useState<MinimalClient[]>(() => getClients());
  const [editing, setEditing] = useState<MinimalClient | null>(null);
  const { toast } = useToast();

  const saveAll = (arr: MinimalClient[]) => { setList(arr); saveClients(arr); };
  const startNew = () => setEditing({ ...empty, id: crypto.randomUUID() });
  const startEdit = (c: MinimalClient) => setEditing({ ...empty, ...c, target_audiences: c.target_audiences || [], talking_points: c.talking_points || [], avoid: c.avoid || [], notes: c.notes || '' });
  const cancel = () => setEditing(null);

  const canSave = useMemo(() => !!editing && editing.name.trim().length > 0, [editing]);

const save = () => {
    if (!editing || !canSave) return;
    const idx = list.findIndex(l => l.id === editing.id);
    const next = idx === -1 ? [editing, ...list] : list.map(l => l.id === editing.id ? editing : l);
    saveAll(next);
    setEditing(null);
    toast({ title: 'Client saved', description: 'Audience, talking points, and avoid tags saved.' });
  };
  const remove = (id: string) => saveAll(list.filter(l => l.id !== id));


  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        <Card className="p-4 card-surface flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Clients</h1>
            <p className="text-sm text-muted-foreground">Only Name is required. Paste your Campaign strategy below; the evaluator will infer the rest.</p>
          </div>
          <Button variant="hero" onClick={startNew}>New Client</Button>
        </Card>

        <Card className="p-4 card-surface">
          <div className="grid gap-2">
            {list.map(c => (
              <div key={c.id} className="grid grid-cols-12 gap-3 items-center border-b border-border/60 py-3">
                <div className="col-span-3 font-medium truncate">
                  {c.media_kit_url ? (
                    <a className="underline-offset-2 hover:underline" href={c.media_kit_url} target="_blank" rel="noreferrer">{c.name}</a>
                  ) : c.name}
                  {c.company && <span className="ml-2 text-sm text-muted-foreground">— {c.company}</span>}
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
            {!list.length && <div className="text-sm text-muted-foreground">No clients yet.</div>}
          </div>
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
      </main>
    </div>
  );
};

export default Clients;
