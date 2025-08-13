import { supabase } from "@/integrations/supabase/client";

export interface AnalyzeResult {
  overall_score: number;
  rubric_breakdown: { dimension: string; weight: number; raw_score: number; notes: string }[];
  // Legacy fields (kept for backward compatibility)
  why_fit: string[];
  why_not_fit: string[];
  recommended_talking_points: string[];
  risk_flags: string[];
  citations: string[];
  scored_by?: 'local-heuristic' | 'ai';
  confidence?: number;
  fallback_reason?: string;

  // New goal-centric fields (optional)
  verdict?: 'recommend' | 'consider' | 'not_recommended';
  verdict_reason?: string;
  why_fit_structured?: { claim: string; evidence: string; interpretation: string }[];
  why_not_fit_structured?: { severity: 'Critical' | 'Major' | 'Minor'; claim: string; evidence: string; interpretation: string }[];
  risk_flags_structured?: { severity: 'Critical' | 'Major' | 'Minor'; flag: string; mitigation: string }[];
  confidence_label?: 'High' | 'Med' | 'Low';
  confidence_note?: string;
  what_would_change?: string[]; // 1–2 items
  summary_text?: string; // 140–200 words for Copy Summary
  show_title?: string; // UI convenience (set client-side)

  // Score auditing (new)
  applied_adjustments?: { type: 'cap' | 'floor' | 'penalty' | 'bonus'; label: string; amount?: number }[];
  audit_notes?: string[];

  // Caps and calibration (new)
  cap_reason?: string;
  cap_type?: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'none';
  audit?: {
    weighted_mean: number;
    adjustments: { genericness: number; multi_concept: number; cadence: number };
    cap_applied: boolean;
    cap_type: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'none';
    cap_evidence: string;
  };

  // Eligibility Filter (new)
  eligibility?: {
    class: 'exclusive' | 'preferential' | 'thematic' | 'none';
    evidence: string;
    spokesperson_inference: 'female' | 'male' | 'unknown';
    spokesperson_inference_confidence: 'high' | 'low' | 'unknown';
    action: 'block' | 'condition' | 'none';
    note: string;
  };
  eligibility_override?: boolean;
  baseline_verdict?: string;
  
  // Publishing insight
  last_published_date?: string;
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