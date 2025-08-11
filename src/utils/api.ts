export interface AnalyzeResult {
  overall_score: number;
  rubric_breakdown: { dimension: string; weight: number; raw_score: number; notes: string }[];
  why_fit: string[];
  why_not_fit: string[];
  recommended_talking_points: string[];
  risk_flags: string[];
  citations: string[];
}

export async function callScrape(url: string) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${base}/functions/v1/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
    body: JSON.stringify({ url })
  });
  return res.json();
}

export async function callAnalyze(payload: {
  client: any;
  show_notes: string;
}) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${base}/functions/v1/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
    body: JSON.stringify(payload)
  });
  return res.json() as Promise<{ success: boolean; error?: string; data?: AnalyzeResult }>;
}
