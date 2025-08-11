
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MinimalClient } from '@/types/clients';
import { getClients, saveClients } from '@/data/clientStore';

const empty: MinimalClient = {
  id: '', name: '', campaign_strategy: '', media_kit_url: ''
};

function deriveGoals(strategy: string, mediaKitUrl: string): string[] {
  const goalsFromLabel = (() => {
    const m = strategy.match(/goals?:\s*([^|\n]+)/i);
    if (m && m[1]) {
      return m[1]
        .split(/[;,•|]/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [] as string[];
  })();

  const out: string[] = [];
  if (/(demo|trial|book a demo|sales call)/i.test(strategy)) out.push('Drive demo bookings');
  if (/(lead|pipeline|mql|sql)/i.test(strategy)) out.push('Generate qualified leads');
  if (/(awareness|brand|top of funnel|reach)/i.test(strategy)) out.push('Grow brand awareness');
  if (/(subscribe|newsletter|followers)/i.test(strategy)) out.push('Increase subscribers/followers');
  if (/(traffic|seo|blog|content)/i.test(strategy)) out.push('Increase qualified site traffic');
  if (/(community|slack|discord|forum)/i.test(strategy)) out.push('Grow community engagement');
  if (/(retention|churn|adoption|activation)/i.test(strategy)) out.push('Improve retention/adoption');
  if (/(thought leadership|authority|category)/i.test(strategy)) out.push('Establish thought leadership');
  if (mediaKitUrl && mediaKitUrl.trim()) out.push('Align with media kit guidelines');

  const combined = [...goalsFromLabel, ...out];
  const deduped = Array.from(new Set(combined));
  return deduped.slice(0, 3);
}

const Clients = () => {
  useEffect(() => { document.title = 'Clients — Podcast Fit Rater'; }, []);
  const [list, setList] = useState<MinimalClient[]>(() => getClients());
  const [editing, setEditing] = useState<MinimalClient | null>(null);

  const saveAll = (arr: MinimalClient[]) => {
    setList(arr);
    saveClients(arr);
  };

  const startNew = () => setEditing({ ...empty, id: crypto.randomUUID() });
  const startEdit = (c: MinimalClient) => setEditing(c);
  const cancel = () => setEditing(null);

  const canSave = useMemo(() => {
    if (!editing) return false;
    return editing.name.trim().length > 0
      && editing.campaign_strategy.trim().length > 0
      && editing.media_kit_url.trim().length > 0;
  }, [editing]);

  const save = () => {
    if (!editing || !canSave) return;
    const idx = list.findIndex(l => l.id === editing.id);
    const next = idx === -1 ? [editing, ...list] : list.map(l => l.id === editing.id ? editing : l);
    saveAll(next);
    setEditing(null);
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
            <p className="text-sm text-muted-foreground">Only Name, Campaign Strategy, and Media Kit URL are required.</p>
          </div>
          <Button variant="hero" onClick={startNew}>New Client</Button>
        </Card>

        <Card className="p-4 card-surface">
          <div className="grid gap-2">
            {list.map(c => (
              <div key={c.id} className="grid grid-cols-6 gap-3 items-center border-b border-border/60 py-3">
                <div className="col-span-2 truncate">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">Goals: {deriveGoals(c.campaign_strategy, c.media_kit_url).join(' • ') || '—'}</div>
                </div>
                <div className="text-sm text-muted-foreground truncate">{c.campaign_strategy}</div>
                <div className="text-sm text-muted-foreground truncate">{c.media_kit_url}</div>
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
          <Card className="p-4 card-surface grid gap-3">
            <h2 className="text-lg font-semibold">{editing.id ? 'Edit Client' : 'New Client'}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Name</label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Media Kit URL</label>
                <Input placeholder="https://..." value={editing.media_kit_url} onChange={(e) => setEditing({ ...editing, media_kit_url: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">Campaign Strategy</label>
                <Textarea rows={6} value={editing.campaign_strategy} onChange={(e) => setEditing({ ...editing, campaign_strategy: e.target.value })} />
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
