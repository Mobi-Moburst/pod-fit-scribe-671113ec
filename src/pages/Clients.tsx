
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/TagInput';
import type { MinimalClient } from '@/types/clients';
import { getClients, saveClients } from '@/data/clientStore';

const empty: MinimalClient = {
  id: '',
  name: '',
  media_kit_url: '',
  company: '',
  target_audiences: [],
  talking_points: [],
  avoid: [],
  notes: '',
  campaign_strategy: '', // keep for backward compatibility
};

const Clients = () => {
  useEffect(() => { document.title = 'Clients — Podcast Fit Rater'; }, []);
  const [list, setList] = useState<MinimalClient[]>(() => getClients());
  const [editing, setEditing] = useState<MinimalClient | null>(null);

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
  };
  const remove = (id: string) => saveAll(list.filter(l => l.id !== id));

  const allAudienceSuggestions = useMemo(() => Array.from(new Set(list.flatMap(c => c.target_audiences || []))), [list]);
  const allTalkingSuggestions = useMemo(() => Array.from(new Set(list.flatMap(c => c.talking_points || []))), [list]);
  const allAvoidSuggestions = useMemo(() => Array.from(new Set(list.flatMap(c => c.avoid || []))), [list]);

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        <Card className="p-4 card-surface flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Clients</h1>
            <p className="text-sm text-muted-foreground">Only Name is required. Use tags for fast entry; the evaluator will infer the rest.</p>
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
                  <div className="flex gap-2 overflow-x-auto whitespace-nowrap pr-2">
                    {(c.target_audiences || []).slice(0,6).map(tag => (
                      <Badge key={tag} variant="secondary" className="shrink-0">{tag}</Badge>
                    ))}
                    {!c.target_audiences?.length && <span className="opacity-70">—</span>}
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
                <Label>Target Audiences</Label>
                <TagInput
                  value={editing.target_audiences || []}
                  onChange={(v) => setEditing({ ...editing, target_audiences: v })}
                  placeholder="CISOs at mid-enterprise • founders • RevOps"
                  suggestions={allAudienceSuggestions}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Talking Points</Label>
                <TagInput
                  value={editing.talking_points || []}
                  onChange={(v) => setEditing({ ...editing, talking_points: v })}
                  placeholder="zero trust • FIDO2/WebAuthn • helpdesk identity"
                  suggestions={allTalkingSuggestions}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Things to Avoid</Label>
                <TagInput
                  value={editing.avoid || []}
                  onChange={(v) => setEditing({ ...editing, avoid: v })}
                  placeholder="crypto • MLM • NFT • Competitor: Duo"
                  suggestions={allAvoidSuggestions}
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
