
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getClients } from '@/data/clientStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const History = () => {
  useEffect(() => { document.title = 'History — Podcast Fit Rater'; }, []);
  const [clientFilter, setClientFilter] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [list, setList] = useState<any[]>(() => JSON.parse(localStorage.getItem('pfr_history') || '[]'));
  const clients = useMemo(() => getClients(), []);
  const clientNameById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  useEffect(() => {
    const reload = () => setList(JSON.parse(localStorage.getItem('pfr_history') || '[]'));
    const onStorage = (e: StorageEvent) => { if (e.key === 'pfr_history') reload(); };
    window.addEventListener('pfr_history_updated', reload);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pfr_history_updated', reload);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const filtered = useMemo(() => list.filter(r => (!clientFilter || r.clientId === clientFilter) && (minScore === '' || (r.overall_score ?? 0) >= (minScore as number))), [list, clientFilter, minScore]);

  const prettifyFromUrl = (u: string) => {
    try {
      const urlObj = new URL(u);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      const base = segments[segments.length - 1] || urlObj.hostname.replace(/^www\./, '');
      const cleaned = decodeURIComponent(base).replace(/[-_]+/g, ' ').trim();
      return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : urlObj.hostname.replace(/^www\./, '');
    } catch {
      return u;
    }
  };

  const getDisplayTitle = (r: any) => r.show_title || prettifyFromUrl(r.url || '');

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
                <div className="grid grid-cols-12 gap-3 items-center border-b border-border/60 py-3">
                  <div className="col-span-5 truncate">{r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer" title={r.url}>{getDisplayTitle(r)}</a> : <span>{getDisplayTitle(r)}</span>}</div>
                  <div className="col-span-3 text-sm text-muted-foreground truncate">{clientNameById[r.clientId] || r.clientId}</div>
                  <div className="col-span-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="font-semibold underline decoration-dotted underline-offset-4" aria-label={`View score breakdown for ${getDisplayTitle(r)}`}>
                          {typeof r.overall_score === 'number' ? Number(r.overall_score).toFixed(1) : r.overall_score}
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{getDisplayTitle(r)} — {typeof r.overall_score === 'number' ? Number(r.overall_score).toFixed(1) : r.overall_score}/10</DialogTitle>
                          <DialogDescription>
                            {r.summary_text ? r.summary_text : 'No summary saved for this entry.'}
                          </DialogDescription>
                        </DialogHeader>
                        {Array.isArray(r.rubric_breakdown) && r.rubric_breakdown.length > 0 ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {r.rubric_breakdown.map((b: any, idx: number) => (
                              <div key={idx} className="p-3 rounded-md border bg-card">
                                <div className="text-sm font-medium">{b.dimension} {(b.weight ? `(${Math.round(b.weight * 100)}%)` : '')}</div>
                                <div className="text-sm">Score: {typeof b.raw_score === 'number' ? Number(b.raw_score).toFixed(1) : b.raw_score}</div>
                                {b.notes && <div className="text-xs text-muted-foreground mt-1">{b.notes}</div>}
                              </div>
                            ))}
                          </div>
                          {Array.isArray(r.applied_adjustments) && r.applied_adjustments.length > 0 && (
                            <div className="mt-4">
                              <div className="text-sm font-medium mb-1">Score adjustments</div>
                              <div className="flex flex-wrap gap-2">
                                {r.applied_adjustments.map((adj: any, i: number) => (
                                  <span key={i} className="text-xs px-2 py-1 rounded border bg-muted">
                                    {(adj.type || 'adj').toUpperCase()}: {adj.label}{typeof adj.amount === 'number' ? ` (${adj.amount > 0 ? '+' : ''}${adj.amount.toFixed(1)})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                      </DialogContent>
                    </Dialog>
                  </div>
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
