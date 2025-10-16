
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const History = () => {
  useEffect(() => { document.title = 'History — Podcast Fit Rater'; }, []);
  const [clientFilter, setClientFilter] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [list, setList] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const clientNameById = useMemo(() => Object.fromEntries(clients.map((c: any) => [c.id, c.name])), [clients]);

  useEffect(() => {
    const load = async () => {
      const { data: batchData } = await supabase
        .from('batch_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (Array.isArray(batchData)) {
        setBatches(batchData);
      }

      const { data: evals } = await supabase.from('evaluations').select('*').order('created_at', { ascending: false });
      const { data: cls } = await supabase.from('clients').select('id,name').order('name', { ascending: true });
      if (Array.isArray(evals)) {
        setList(evals.map((r: any) => ({
          id: r.id,
          ...(r.rubric_json || {}),
          url: r.url,
          show_title: r.show_title,
          overall_score: r.overall_score,
          clientId: r.client_id,
          batch_session_id: r.batch_session_id,
          date: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        })));
      }
      if (Array.isArray(cls)) setClients(cls);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return list.filter(r => {
      if (clientFilter && r.clientId !== clientFilter) return false;
      if (minScore !== '' && (r.overall_score ?? 0) < (minScore as number)) return false;
      if (selectedBatch === '__individual__' && r.batch_session_id) return false;
      if (selectedBatch && selectedBatch !== '__individual__' && r.batch_session_id !== selectedBatch) return false;
      return true;
    });
  }, [list, clientFilter, minScore, selectedBatch]);

  const groupedData = useMemo(() => {
    const individual: any[] = [];
    const batched: Map<string, any[]> = new Map();
    
    filtered.forEach(r => {
      if (r.batch_session_id) {
        if (!batched.has(r.batch_session_id)) {
          batched.set(r.batch_session_id, []);
        }
        batched.get(r.batch_session_id)!.push(r);
      } else {
        individual.push(r);
      }
    });
    
    return { individual, batched };
  }, [filtered]);

  const batchMetadata = useMemo(() => {
    return new Map(batches.map(b => [b.id, b]));
  }, [batches]);

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

  const deleteEvaluation = async (evalId: string, title: string) => {
    const { error } = await supabase
      .from('evaluations')
      .delete()
      .eq('id', evalId);
    
    if (error) {
      toast.error('Failed to delete evaluation');
      console.error(error);
      return;
    }
    
    // Remove from local state
    setList(prev => prev.filter(e => e.id !== evalId));
    toast.success('Evaluation deleted');
  };

  const deleteBatch = async (batchId: string, batchName: string, evaluationCount: number) => {
    const { error } = await supabase
      .from('batch_sessions')
      .delete()
      .eq('id', batchId);
    
    if (error) {
      toast.error('Failed to delete batch');
      console.error(error);
      return;
    }
    
    // Remove batch and its evaluations from local state
    setBatches(prev => prev.filter(b => b.id !== batchId));
    setList(prev => prev.filter(e => e.batch_session_id !== batchId));
    toast.success(`Batch "${batchName}" deleted (${evaluationCount} evaluation${evaluationCount !== 1 ? 's' : ''})`);
  };

  const BatchRow = ({ 
    batchId, 
    evaluations, 
    metadata,
    clientNameById,
    getDisplayTitle,
    onDeleteBatch,
    onDeleteEvaluation
  }: any) => {
    const [isOpen, setIsOpen] = useState(selectedBatch === batchId);
    
    const avgScore = evaluations.reduce((sum: number, e: any) => 
      sum + (e.overall_score || 0), 0) / evaluations.length;
    
    const batchInfo = metadata.get(batchId);
    const batchName = batchInfo?.name || `Batch`;
    const batchDate = evaluations[0]?.date || Date.now();
    const clientId = evaluations[0]?.clientId;
    
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="grid grid-cols-12 gap-3 items-center border-b border-border/60 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="col-span-5 flex items-center gap-2">
              <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <span className="font-medium">{batchName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                {evaluations.length} {evaluations.length === 1 ? 'podcast' : 'podcasts'}
              </span>
            </div>
            <div className="col-span-3 text-sm text-muted-foreground truncate">
              {clientNameById[clientId] || clientId}
            </div>
            <div className="col-span-2 font-semibold">
              Avg: {avgScore.toFixed(1)}
            </div>
            <div className="col-span-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>{new Date(batchDate).toLocaleString()}</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                    aria-label="Delete batch"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete batch "{batchName}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this batch and all {evaluations.length} podcast evaluation{evaluations.length !== 1 ? 's' : ''} within it. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onDeleteBatch(batchId, batchName, evaluations.length)} 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Batch
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="ml-8 border-l-2 border-border/40 pl-4">
            {evaluations.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-center border-b border-border/30 py-2">
                <div className="col-span-5 truncate">
                  {r.url ? (
                    <a className="underline text-sm" href={r.url} target="_blank" rel="noreferrer" title={r.url}>
                      {getDisplayTitle(r)}
                    </a>
                  ) : (
                    <span className="text-sm">{getDisplayTitle(r)}</span>
                  )}
                </div>
                <div className="col-span-3"></div>
                <div className="col-span-2 flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="font-semibold underline decoration-dotted underline-offset-4 text-sm" aria-label={`View score breakdown for ${getDisplayTitle(r)}`}>
                        {typeof r.overall_score === 'number' ? r.overall_score.toFixed(1) : r.overall_score}
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{getDisplayTitle(r)} — {typeof r.overall_score === 'number' ? r.overall_score.toFixed(1) : r.overall_score}/10</DialogTitle>
                        <DialogDescription>
                          {r.summary_text ? r.summary_text : 'No summary saved for this entry.'}
                        </DialogDescription>
                      </DialogHeader>
                      {Array.isArray(r.rubric_breakdown) && r.rubric_breakdown.length > 0 ? (
                        <>
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
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No rubric breakdown available.</div>
                      )}
                    </DialogContent>
                  </Dialog>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button 
                        className="p-1 hover:bg-destructive/10 rounded transition-colors" 
                        aria-label="Delete evaluation"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this evaluation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the evaluation for "{getDisplayTitle(r)}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => onDeleteEvaluation(r.id, getDisplayTitle(r))} 
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="col-span-2"></div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        <Card className="p-4 card-surface grid md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-sm">Client</label>
            <select className="h-10 rounded-md border bg-background px-3 w-full" value={clientFilter} onChange={(e)=>setClientFilter(e.target.value)}>
              <option value="">All</option>
              {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm">Batch</label>
            <select className="h-10 rounded-md border bg-background px-3 w-full" value={selectedBatch} onChange={(e)=>setSelectedBatch(e.target.value)}>
              <option value="">All (Individual + Batches)</option>
              <option value="__individual__">Individual Only</option>
              {batches.map(b => (<option key={b.id} value={b.id}>{b.name} ({b.success_count} items)</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm">Min Score</label>
            <Input type="number" step="0.5" value={minScore} onChange={(e)=> setMinScore(e.target.value ? Number(e.target.value) : '')} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={async ()=>{ await supabase.from('evaluations').delete().not('id','is',null); setList([]); }}>Clear History</Button>
          </div>
        </Card>

        <Card className="p-4 card-surface">
          <div className="grid gap-2">
            {Array.from(groupedData.batched.entries())
              .sort(([, evalsA], [, evalsB]) => {
                const dateA = Math.max(...evalsA.map(e => e.date));
                const dateB = Math.max(...evalsB.map(e => e.date));
                return dateB - dateA;
              })
              .map(([batchId, evals]) => (
                <BatchRow
                  key={batchId}
                  batchId={batchId}
                  evaluations={evals}
                  metadata={batchMetadata}
                  clientNameById={clientNameById}
                  getDisplayTitle={getDisplayTitle}
                  onDeleteBatch={deleteBatch}
                  onDeleteEvaluation={deleteEvaluation}
                />
              ))}
            
            {groupedData.individual
              .sort((a, b) => b.date - a.date)
              .map((r, i) => (
                <div key={`ind-${i}`} className="grid grid-cols-12 gap-3 items-center border-b border-border/60 py-3">
                  <div className="col-span-5 truncate">
                    {r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer" title={r.url}>{getDisplayTitle(r)}</a> : <span>{getDisplayTitle(r)}</span>}
                  </div>
                  <div className="col-span-3 text-sm text-muted-foreground truncate">{clientNameById[r.clientId] || r.clientId}</div>
                  <div className="col-span-2 flex items-center gap-2">
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
                          <>
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
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">No rubric breakdown available.</div>
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button 
                          className="p-1 hover:bg-destructive/10 rounded transition-colors" 
                          aria-label="Delete evaluation"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this evaluation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the evaluation for "{getDisplayTitle(r)}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteEvaluation(r.id, getDisplayTitle(r))} 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
