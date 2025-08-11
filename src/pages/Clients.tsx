import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { mockClients, ClientProfile } from '@/data/mockClients';

const empty: ClientProfile = {
  id: '', name: '', ICP: '', target_roles: [], topics_to_prioritize: [], topics_to_avoid: [], keywords_positive: [], keywords_negative: [], content_goals: '', CTA: ''
};

const Clients = () => {
  useEffect(() => { document.title = 'Clients — Podcast Fit Rater'; }, []);
  const [list, setList] = useState<ClientProfile[]>(() => {
    const saved = localStorage.getItem('pfr_clients');
    return saved ? JSON.parse(saved) : mockClients;
  });
  const [editing, setEditing] = useState<ClientProfile | null>(null);

  const saveAll = (arr: ClientProfile[]) => {
    setList(arr);
    localStorage.setItem('pfr_clients', JSON.stringify(arr));
  };

  const startNew = () => setEditing({ ...empty, id: crypto.randomUUID() });
  const startEdit = (c: ClientProfile) => setEditing(c);
  const cancel = () => setEditing(null);
  const save = () => {
    if (!editing) return;
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
            <p className="text-sm text-muted-foreground">Local-only for now. Supabase integration can be added later.</p>
          </div>
          <Button variant="hero" onClick={startNew}>New Client</Button>
        </Card>

        <Card className="p-4 card-surface">
          <div className="grid gap-2">
            {list.map(c => (
              <div key={c.id} className="grid grid-cols-6 gap-3 items-center border-b border-border/60 py-3">
                <div className="col-span-2 font-medium">{c.name}</div>
                <div className="text-sm text-muted-foreground truncate">{c.ICP}</div>
                <div className="text-sm text-muted-foreground truncate">{c.content_goals}</div>
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
                <label className="text-sm">Company</label>
                <Input value={editing.company || ''} onChange={(e) => setEditing({ ...editing, company: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">ICP</label>
                <Textarea value={editing.ICP} onChange={(e) => setEditing({ ...editing, ICP: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Target Roles (comma-separated)</label>
                <Input value={editing.target_roles.join(', ')} onChange={(e) => setEditing({ ...editing, target_roles: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <label className="text-sm">Company Sizes</label>
                <Input value={editing.target_company_sizes || ''} onChange={(e) => setEditing({ ...editing, target_company_sizes: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Regions</label>
                <Input value={editing.target_regions || ''} onChange={(e) => setEditing({ ...editing, target_regions: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Prioritize Topics</label>
                <Input value={editing.topics_to_prioritize.join(', ')} onChange={(e) => setEditing({ ...editing, topics_to_prioritize: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <label className="text-sm">Avoid Topics</label>
                <Input value={editing.topics_to_avoid.join(', ')} onChange={(e) => setEditing({ ...editing, topics_to_avoid: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <label className="text-sm">Positive Keywords</label>
                <Input value={editing.keywords_positive.join(', ')} onChange={(e) => setEditing({ ...editing, keywords_positive: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <label className="text-sm">Negative Keywords</label>
                <Input value={editing.keywords_negative.join(', ')} onChange={(e) => setEditing({ ...editing, keywords_negative: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <label className="text-sm">Content Goals</label>
                <Input value={editing.content_goals} onChange={(e) => setEditing({ ...editing, content_goals: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">CTA</label>
                <Input value={editing.CTA} onChange={(e) => setEditing({ ...editing, CTA: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">Notes</label>
                <Textarea value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancel}>Cancel</Button>
              <Button variant="hero" onClick={save}>Save</Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Clients;
