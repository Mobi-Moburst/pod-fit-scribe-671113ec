
import { supabase } from "@/integrations/supabase/client";

export interface AnalyzeResult {
  overall_score: number;
  rubric_breakdown: { dimension: string; weight: number; raw_score: number; notes: string }[];
  why_fit: string[];
  why_not_fit: string[];
  recommended_talking_points: string[];
  risk_flags: string[];
  citations: string[];
  scored_by?: 'local-heuristic' | 'ai';
  confidence?: number;
}

export async function callScrape(url: string) {
  const { data, error } = await supabase.functions.invoke('scrape', {
    body: { url },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return data;
}

export async function callAnalyze(payload: {
  client: any;
  show_notes: string;
}) {
  const { data, error } = await supabase.functions.invoke('analyze', {
    body: payload,
  });
  if (error) {
    return { success: false, error: error.message } as { success: boolean; error?: string; raw?: string; data?: AnalyzeResult };
  }
  return data as { success: boolean; error?: string; raw?: string; data?: AnalyzeResult };
}
