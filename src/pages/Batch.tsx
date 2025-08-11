import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';
import { callAnalyze, callScrape, AnalyzeResult } from '@/utils/api';
import { getClients } from '@/data/clientStore';

interface Row {
  client_id?: string;
  client_name?: string;
  company?: string;
  media_kit_url?: string;
  target_audiences?: string; // comma/pipe/• separated
  talking_points?: string;
  avoid?: string;
  notes?: string;
  podcast_url?: string;
  url?: string; // alias
}

const parseList = (s?: string) => (s || '')
  .split(/[;,|•]/)
  .map((x) => x.trim())
  .filter(Boolean);

const Batch = () => {
  useEffect(() => { document.title = 'Batch — Podcast Fit Rater'; }, []);
  const [rows, setRows] = useState<Row[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleCSV = (file: File) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => setRows(data.filter(r => (r.podcast_url || r.url))),
    });
  };

  const savedClients = useMemo(() => getClients(), []);

  const resolveClient = (r: Row) => {
    const byId = r.client_id && savedClients.find(c => c.id === r.client_id);
    if (byId) return byId;
    const byName = r.client_name && savedClients.find(c => c.name.toLowerCase() === r.client_name!.toLowerCase());
    if (byName) return byName;
    // Compose a minimal client from CSV row
    return {
      id: r.client_id || crypto.randomUUID(),
      name: r.client_name || 'Unnamed',
      company: r.company,
      media_kit_url: r.media_kit_url || '',
      target_audiences: parseList(r.target_audiences),
      talking_points: parseList(r.talking_points),
      avoid: parseList(r.avoid),
      notes: r.notes || '',
    };
  };

  const start = async () => {
    setProcessing(true); setResults([]);
    for (const r of rows) {
      try {
        const client = resolveClient(r);
        const purl = r.podcast_url || r.url || '';
        const s = await callScrape(purl);
        const notes = s?.show_notes || '';
        if (!notes) {
          setResults(prev => [...prev, { url: purl, error: 'No notes' }]);
          continue;
        }
        const resp = await callAnalyze({ client, show_notes: notes });
        const data = resp.data as AnalyzeResult | undefined;
        setResults(prev => [...prev, {
          url: purl,
          show_title: s?.title,
          overall_score: data?.overall_score,
          top_3_reasons: data?.why_fit?.slice(0,3)?.join(' | '),
          risk_flags: data?.risk_flags?.join(' | '),
        }]);
      } catch (_e) {
        const purl = r.podcast_url || r.url || '';
        setResults(prev => [...prev, { url: purl, error: 'Failed' }]);
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
              <p className="text-sm text-muted-foreground">Upload CSV with columns: client_id, client_name, company, media_kit_url, target_audiences, talking_points, avoid, notes, podcast_url</p>
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
