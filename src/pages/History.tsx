
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getClients } from '@/data/clientStore';

const History = () => {
  useEffect(() => { document.title = 'History — Podcast Fit Rater'; }, []);
  const [clientFilter, setClientFilter] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [list, setList] = useState<any[]>(() => JSON.parse(localStorage.getItem('pfr_history') || '[]'));
  const clients = useMemo(() => getClients(), []);
  const clientNameById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  const filtered = useMemo(() => list.filter(r => (!clientFilter || r.clientId === clientFilter) && (minScore === '' || (r.overall_score ?? 0) >= (minScore as number))), [list, clientFilter, minScore]);

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        <Card className="p-4 card-surface grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-sm">Client</label>
            <select className="h-10 rounded-md border bg-background px-3 w-full" value={clientFilter} onChange={(e)=>setClientFilter(e.target.value)}>
              <option value="">All</option>
              {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm">Min Score</label>
            <Input type="number" step="0.5" value={minScore} onChange={(e)=> setMinScore(e.target.value ? Number(e.target.value) : '')} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={()=>{ localStorage.removeItem('pfr_history'); setList([]); }}>Clear History</Button>
          </div>
        </Card>

        <Card className="p-4 card-surface">
          <div className="grid gap-2">
            {filtered.map((r,i)=> (
              <div key={i} className="grid grid-cols-12 gap-3 items-center border-b border-border/60 py-3">
                <div className="col-span-5 truncate"><a className="underline" href={r.url} target="_blank" rel="noreferrer">{r.url}</a></div>
                <div className="col-span-3 text-sm text-muted-foreground truncate">{clientNameById[r.clientId] || r.clientId}</div>
                <div className="col-span-2 font-semibold">{r.overall_score}</div>
                <div className="col-span-2 text-sm text-muted-foreground">{new Date(r.date).toLocaleString()}</div>
              </div>
            ))}
            {!filtered.length && <div className="text-sm text-muted-foreground">No results match your filters.</div>}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default History;
