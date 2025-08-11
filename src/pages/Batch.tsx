import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';
import { callAnalyze, callScrape, AnalyzeResult } from '@/utils/api';
import { mockClients } from '@/data/mockClients';

interface Row { client_id: string; podcast_url: string }

const Batch = () => {
  useEffect(() => { document.title = 'Batch — Podcast Fit Rater'; }, []);
  const [rows, setRows] = useState<Row[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleCSV = (file: File) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => setRows(data.filter(r => r.client_id && r.podcast_url))
    });
  };

  const start = async () => {
    setProcessing(true); setResults([]);
    for (const r of rows) {
      try {
        const client = mockClients.find(c => c.id === r.client_id);
        if (!client) { continue; }
        const s = await callScrape(r.podcast_url);
        const notes = s?.show_notes || '';
        if (!notes) {
          setResults(prev => [...prev, { url: r.podcast_url, error: 'No notes' }]);
          continue;
        }
        const resp = await callAnalyze({ client, show_notes: notes });
        const data = resp.data as AnalyzeResult | undefined;
        setResults(prev => [...prev, {
          url: r.podcast_url,
          show_title: s?.title,
          overall_score: data?.overall_score,
          top_3_reasons: data?.why_fit?.slice(0,3)?.join(' | '),
          risk_flags: data?.risk_flags?.join(' | '),
        }]);
      } catch (e) {
        setResults(prev => [...prev, { url: r.podcast_url, error: 'Failed' }]);
      }
    }
    setProcessing(false);
  };

  const exportCsv = () => {
    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'batch-results.csv';
    a.click();
  };

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6 grid gap-6">
        <Card className="p-4 card-surface">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold">Batch Evaluation</h1>
              <p className="text-sm text-muted-foreground">Upload CSV with columns: client_id, podcast_url</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="file" accept=".csv" onChange={(e) => e.target.files && handleCSV(e.target.files[0])} />
              <Button variant="hero" onClick={start} disabled={!rows.length || processing}>Start</Button>
              <Button variant="outline" onClick={exportCsv} disabled={!results.length}>Export CSV</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 card-surface">
          <div className="grid gap-2">
            {rows.length === 0 && <div className="text-sm text-muted-foreground">No rows loaded yet.</div>}
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/60 py-2">
                <div className="truncate max-w-[60%]">{r.url}</div>
                <div className="text-sm text-muted-foreground">{r.show_title || r.error || ''}</div>
                <div className="font-semibold">{r.overall_score ?? '-'}</div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Batch;
