import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------- Heuristic scorer utilities ----------------
const clamp = (n: number, min = 0, max = 10) => Math.max(min, Math.min(max, n));
const roundToHalf = (n: number) => Math.round(n * 2) / 2;
function tokenize(s: string): string[] {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
const STOPWORDS = new Set([
  "the","and","a","an","of","in","on","for","to","with","by","is","are","it","this","that","as","at","be","from","or","we","you","our","your","about","into","how","what","why","when","where","which"
]);
function extractKeywords(text: string): string[] {
  const words = tokenize(text).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 80);
}
function countOccurrences(text: string, terms: string[]): number {
  const lower = (text || "").toLowerCase();
  let count = 0;
  for (const t of terms) {
    if (!t) continue;
    const re = new RegExp(`\\b${t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
    count += (lower.match(re) || []).length;
  }
  return count;
}
function findMatchesPositions(text: string, terms: string[], max = 6): { term: string; index: number }[] {
  const lower = text.toLowerCase();
  const found: { term: string; index: number }[] = [];
  for (const t of terms) {
    const re = new RegExp(`\\b${t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      found.push({ term: t, index: m.index });
      if (found.length >= max) return found;
    }
  }
  return found;
}
function quoteAround(text: string, idx: number, radius = 60): string {
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  const snippet = text.slice(start, end).trim();
  const dot = snippet.indexOf(". ");
  return (dot > 20 ? snippet.slice(0, dot + 1) : snippet).replace(/\s+/g, " ");
}
function quote(text: string, phrase: string, maxLen = 80): string | null {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(phrase.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + phrase.length + 40);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function scoreHeuristic(client: any, show_notes: string) {
  const notes: string = String(show_notes || "");
  const notesTokens = tokenize(notes);

  const talking: string[] = (client?.talking_points || client?.keywords_positive || []) as string[];
  const audiences: string[] = (client?.target_audiences || client?.target_roles || []) as string[];
  const avoids: string[] = (client?.avoid || client?.keywords_negative || []) as string[];
  const notesPref: string = String(client?.notes || client?.campaign_strategy || "");
  const mediaKitUrl: string = String(client?.media_kit_url || "");

  // Topic relevance: exact phrase overlaps with Talking Points
  const matchedTalking = (talking || []).filter(tp => tp && new RegExp(tp.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), 'i').test(notes));
  const topicRelevance = talking.length
    ? clamp((matchedTalking.length / Math.max(1, talking.length)) * 10)
    : clamp(5 + Math.min(4, extractKeywords(notes).length / 20));

  // ICP alignment: audience terms present
  const matchedAud = (audiences || []).filter(a => a && new RegExp(a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), 'i').test(notes));
  const icpAlignment = audiences.length
    ? clamp(3 + Math.min(7, matchedAud.length * 2))
    : clamp(4 + Math.min(4, extractKeywords(notes).length / 25));

  // Recency/consistency: detect simple time cues and length
  const recentYear = /(202[3-6])/i.test(notes) ? 1 : 0;
  const monthMention = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.test(notes) ? 1 : 0;
  const episodePattern = /(episode\s*#?\s*\d{1,4}|ep\s*\d{1,4}|season\s*\d{1,2})/i.test(notes) ? 1 : 0;
  const recencySignals = recentYear + monthMention + episodePattern;
  const recencyConsistency = clamp(3 + recencySignals * 2.5 + Math.min(3, Math.floor(notesTokens.length / 600)));

  // CTA synergy: infer generically and from notes preferences
  const ctaTerms = [
    "subscribe","download","book","demo","sign","signup","sign-up","start","trial","join","waitlist","apply","contact","learn more","read more","visit","follow","try"
  ];
  const prefCtas = (notesPref.match(/(cta|call to action):?\s*([^\n|]+)/i)?.[2] || '')
    .split(/[;,|•]/).map(s=>s.trim()).filter(Boolean);
  const ctaOverlap = [
    ...ctaTerms.filter((t) => new RegExp(`\\b${t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, 'i').test(notes)),
    ...prefCtas.filter((t) => new RegExp(t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), 'i').test(notes))
  ];
  const ctaSynergy = clamp(3 + Math.min(7, ctaOverlap.length * 1.5));

  // Brand suitability: compare tone keywords from Additional Notes
  const toneDesired = (notesPref || "").toLowerCase();
  const tonePosCues = ["authoritative","technical","tactical","educational","interview","data-driven","case study","no pay-to-play"]
    .filter((t) => toneDesired.includes(t));
  const toneNegCues = ["explicit","nsfw","politics","gambling","hype","clickbait"]
    .filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(notes));
  const brandSuitability = clamp(5 + tonePosCues.length * 1.2 - toneNegCues.length * 2);

  // Apply caps/floors
  const avoidHitPhrases = (avoids || []).filter(a => a && new RegExp(a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), 'i').test(notes));
  const strongAvoid = avoidHitPhrases.length > 0;
  const zeroTalkingOverlap = talking.length > 0 && matchedTalking.length === 0;
  const strongAlignment = matchedTalking.length >= 3 && matchedAud.length >= 2;

  const weights = { topic: 0.35, icp: 0.25, recency: 0.15, cta: 0.15, brand: 0.10 } as const;
  let overall = topicRelevance * weights.topic + icpAlignment * weights.icp + recencyConsistency * weights.recency + ctaSynergy * weights.cta + brandSuitability * weights.brand;
  const bothZero = (talking.length > 0 && matchedTalking.length === 0) && (audiences.length > 0 && matchedAud.length === 0);
  if (strongAvoid) overall = Math.min(overall, 4.0);
  if (bothZero) overall = Math.min(overall, 3.0);
  else if (zeroTalkingOverlap) overall = Math.min(overall, 4.0);
  if (strongAlignment) overall = Math.max(overall, 7.5);
  overall = roundToHalf(overall);

  // Citations: 2–6 short quotes from talking points / audience hits
  const quoteTerms = [
    ...matchedTalking.slice(0, 4),
    ...matchedAud.slice(0, 2),
  ];
  const citations = quoteTerms
    .map((t) => quote(notes, t))
    .filter(Boolean)
    .slice(0, 6) as string[];

  const rubric_breakdown = [
    { dimension: "Topic relevance", weight: 0.35, raw_score: roundToHalf(topicRelevance), notes: matchedTalking[0] ? `Matches: "${matchedTalking.slice(0,3).join('" · "')}"` : "Limited explicit overlap with Talking Points" },
    { dimension: "ICP alignment", weight: 0.25, raw_score: roundToHalf(icpAlignment), notes: matchedAud[0] ? `Audience cues: ${matchedAud.slice(0,3).join(', ')}` : "Few explicit audience cues" },
    { dimension: "Recency/consistency", weight: 0.15, raw_score: roundToHalf(recencyConsistency), notes: recencySignals ? "Recent dates/episodes mentioned" : "No clear recency markers" },
    { dimension: "CTA synergy", weight: 0.15, raw_score: roundToHalf(ctaSynergy), notes: ctaOverlap.length ? `CTA cues: ${ctaOverlap.slice(0,3).join(', ')}` : "Generic or weak CTAs" },
    { dimension: "Brand suitability", weight: 0.10, raw_score: roundToHalf(brandSuitability), notes: toneNegCues.length ? "Tone risks present" : tonePosCues.length ? "Tone seems aligned" : "Neutral tone" },
  ];

  const why_fit: string[] = [];
  if (matchedTalking.length) why_fit.push(`Direct overlap with Talking Points (${matchedTalking.length})`);
  if (matchedAud.length) why_fit.push(`Audience mentions: ${matchedAud.slice(0,3).join(', ')}`);
  if (ctaOverlap.length) why_fit.push(`CTA-compatible: ${ctaOverlap.slice(0,2).join(', ')}`);
  const why_not_fit: string[] = [];
  if (!matchedTalking.length) why_not_fit.push("No explicit match to Talking Points");
  if (!matchedAud.length && audiences.length) why_not_fit.push("Audience not clearly aligned");
  if (strongAvoid) why_not_fit.push(`Contains avoid term: \"${avoidHitPhrases[0]}\"`);

  const recommended_talking_points = [
    matchedAud[0] ? `Hook on ${matchedAud[0]} pain points` : "Open with a concrete audience pain",
    matchedTalking[0] ? "Lean into shared topic intersections from recent episodes" : "Bridge from their recent themes to your value prop",
    ctaOverlap[0] ? `Echo their CTA style (e.g., \"${ctaOverlap[0]}\")` : "Use a single clear CTA that matches episode content",
    "Bring proof (case study/metrics) to increase credibility",
  ];

  // Confidence: lower if media kit is missing
  let confidence = 0.45 + Math.min(0.2, notesTokens.length / 5000) + (matchedTalking.length > 0 ? 0.1 : 0) + (matchedAud.length > 0 ? 0.1 : 0) - (!mediaKitUrl ? 0.1 : 0);
  confidence = Math.max(0.25, Math.min(0.95, confidence));

  return {
    overall_score: overall,
    rubric_breakdown,
    why_fit,
    why_not_fit,
    recommended_talking_points,
    risk_flags: [strongAvoid ? "Contains avoid terms (brand risk)" : undefined].filter(Boolean) as string[],
    citations: citations.length ? citations : extractKeywords(notes).slice(0, 6),
    scored_by: "local-heuristic" as const,
    confidence,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, show_notes } = await req.json();
    if (!client || !show_notes) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing client or show_notes" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const name = client?.name ?? "";
    const campaign_strategy = client?.campaign_strategy ?? "";
    const media_kit_url = client?.media_kit_url ?? "";

    if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim()) {
      const base = scoreHeuristic(client, String(show_notes || ""));
      const data = { ...base, fallback_reason: "Missing OPENAI_API_KEY" };
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `You are evaluating PODCAST_SHOW_NOTES for fit against a minimal CLIENT_PROFILE.\nReturn JSON only that matches the schema. Use short direct quotes (5–12 words). Be specific and concise.\n\nInference rules:\n- Infer ICP/persona, tone, CTA, and industry from the Media Kit (if available) and the show notes; do not require explicit CTA fields.\n- Treat “Things to Avoid” as hard guardrails for scoring.\n- Use Talking Points + Target Audiences as primary signals for topic relevance and ICP alignment.\n\nCLIENT_PROFILE (minimal):\n- Name: ${client?.name ?? ''}\n- Company: ${client?.company ?? ''}\n- Media Kit URL: ${client?.media_kit_url ?? ''}\n- Target Audiences: ${(client?.target_audiences || []).join(', ')}\n- Talking Points: ${(client?.talking_points || []).join(', ')}\n- Things to Avoid: ${(client?.avoid || []).join(', ')}\n- Additional Notes: ${client?.notes ?? ''}\n\nPODCAST_SHOW_NOTES (plain text):\n${String(show_notes)}\n\nSCORING DIMENSIONS AND WEIGHTS:\n- Topic relevance (0.35) → match Talking Points (quote exact phrases).\n- ICP alignment (0.25) → infer from Target Audiences + media kit.\n- Recency/consistency (0.15) → infer from show notes language/dates.\n- CTA synergy (0.15) → infer CTA from media kit/notes (no field needed).\n- Brand suitability (0.10) → compare media kit tone vs. Additional Notes.\n\nCaps/Floors:\n- If any strong Avoid term/brand appears → cap overall at 5.0 (explain with a quote).\n- If zero overlap with Talking Points → cap at 6.5.\n- If ≥3 Talking Points appear AND audience match is strong → floor at 7.5.\n- Round to nearest 0.5 and include 2–6 short quotes in reasons.\n- Confidence: lower if Media Kit is missing/unreachable.\n\nJSON schema to return:\n{\n  "overall_score": number,\n  "rubric_breakdown": [\n    {"dimension": "Topic relevance", "weight": 0.35, "raw_score": 0-10, "notes": "string with 1–2 quotes"},\n    {"dimension": "ICP alignment", "weight": 0.25, "raw_score": 0-10, "notes": "string with 1–2 quotes"},\n    {"dimension": "Recency/consistency", "weight": 0.15, "raw_score": 0-10, "notes": "string"},\n    {"dimension": "CTA synergy", "weight": 0.15, "raw_score": 0-10, "notes": "string"},\n    {"dimension": "Brand suitability", "weight": 0.10, "raw_score": 0-10, "notes": "string"}\n  ],\n  "why_fit": ["bullets with short quotes"],\n  "why_not_fit": ["bullets with short quotes"],\n  "recommended_talking_points": ["3–5 bullets tailored to client"],\n  "risk_flags": ["bullets with brief rationale"],\n  "citations": ["short direct phrases pulled from notes (2–6 items)"]\n}`;

    const body = {
      model: "gpt-4.1-2025-04-14",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Be precise and concise. Return JSON ONLY. No prose." },
        { role: "user", content: prompt },
      ],
    } as const;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000); // 20s timeout

    let json: any = null;
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(t);

      try { json = await resp.json(); } catch (err) {
        console.error("OpenAI response JSON parse error", err);
      }

      if (!resp.ok) {
        console.error("OpenAI API error", json || { status: resp.status, statusText: resp.statusText });
        const errMsg = json?.error?.message || resp.statusText || `status ${resp.status}`;
        const base = scoreHeuristic(client, String(show_notes || ""));
        const data = { ...base, fallback_reason: `OpenAI API error: ${errMsg}` };
        return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const text = json?.choices?.[0]?.message?.content || "";
      let data: any = null;
      let cleaned = (text || "").trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
      try { data = JSON.parse(cleaned); } catch (_e) {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try { data = JSON.parse(cleaned.slice(start, end + 1)); } catch {}
        }
      }

      if (!data) {
        console.error("LLM returned invalid JSON", String(cleaned).slice(0, 500));
        const fb = scoreHeuristic(client, String(show_notes || ""));
        const data = { ...fb, fallback_reason: "LLM returned invalid JSON" };
        return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Post-process AI result to enforce strict caps/floors using client vs notes
      const notesText = String(show_notes || "");
      const tp = (client?.talking_points || []) as string[];
      const aud = (client?.target_audiences || []) as string[];
      const av = (client?.avoid || []) as string[];
      const tpMatches = tp.filter((t) => t && new RegExp(t.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), 'i').test(notesText));
      const audMatches = aud.filter((a) => a && new RegExp(a.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), 'i').test(notesText));
      const avoidHits = av.filter((a) => a && new RegExp(a.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), 'i').test(notesText));
      const zeroTP = tp.length > 0 && tpMatches.length === 0;
      const zeroAUD = aud.length > 0 && audMatches.length === 0;
      const bothZeroMatch = zeroTP && zeroAUD;
      const strongAvoidLLM = avoidHits.length > 0;

      let adjusted = Number(data?.overall_score) || 0;
      if (strongAvoidLLM) adjusted = Math.min(adjusted, 4.0);
      if (bothZeroMatch) adjusted = Math.min(adjusted, 3.0);
      else if (zeroTP) adjusted = Math.min(adjusted, 4.0);
      // Preserve positive floor if exceptionally strong match
      if (tpMatches.length >= 3 && audMatches.length >= 2) adjusted = Math.max(adjusted, 7.5);
      adjusted = roundToHalf(Math.max(0, Math.min(10, adjusted)));

      const tagged = { ...data, scored_by: "ai" as const, overall_score: adjusted };
      return new Response(JSON.stringify({ success: true, data: tagged }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: any) {
      clearTimeout(t);
      console.error("OpenAI call error, using heuristic fallback", e);
      const base = scoreHeuristic(client, String(show_notes || ""));
      const reason = e?.name === 'AbortError' ? 'LLM timeout (>20s)' : (e?.message || 'LLM call failed');
      const data = { ...base, fallback_reason: reason };
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (_e) {
    return new Response(
      JSON.stringify({ success: false, error: "Analyze error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
