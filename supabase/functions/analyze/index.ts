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
function scoreHeuristic(client: any, show_notes: string) {
  const campaign_strategy: string = client?.campaign_strategy ?? "";
  const notes: string = String(show_notes || "");
  const notesTokens = tokenize(notes);
  const strategyKeywords = extractKeywords(campaign_strategy);
  const audienceTerms = [
    "founder","founders","ceo","cmo","marketer","marketing","demand","brand","growth","sales","revops","product","developer","engineer","cto","smb","enterprise","b2b","b2c","saas","ecommerce","startup","scaleup","hr","recruiting","revenue"
  ];
  const ctaTerms = [
    "subscribe","download","book","demo","sign","signup","sign-up","start","trial","join","waitlist","apply","contact","learn","learn more","read more","visit","follow","try"
  ];
  const tonePositive = [
    "tactical","practical","educational","case study","deep dive","actionable","technical","expert","framework","playbook","how to","step-by-step"
  ];
  const toneNegative = [
    "explicit","nsfw","politics","political","gambling","get rich quick","self-help only","conspiracy"
  ];

  const uniqueKeywordMatches = new Set<string>();
  for (const kw of strategyKeywords) {
    const re = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(notes)) uniqueKeywordMatches.add(kw);
  }
  const audienceOverlapInStrategy = audienceTerms.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(campaign_strategy));
  const audienceOverlapInNotes = audienceTerms.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(notes));
  const audienceOverlap = audienceOverlapInStrategy.filter((t) => audienceOverlapInNotes.includes(t));
  const ctaOverlapInStrategy = ctaTerms.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(campaign_strategy));
  const ctaOverlapInNotes = ctaTerms.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(notes));
  const ctaOverlap = ctaOverlapInStrategy.filter((t) => ctaOverlapInNotes.includes(t));
  const posToneHits = tonePositive.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(notes)).length;
  const negToneHits = toneNegative.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(notes)).length;
  const recentYear = /(202[3-6])/i.test(notes) ? 1 : 0;
  const monthMention = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.test(notes) ? 1 : 0;
  const episodePattern = /(episode\s*#?\s*\d{1,4}|ep\s*\d{1,4}|season\s*\d{1,2})/i.test(notes) ? 1 : 0;
  const recencySignals = recentYear + monthMention + episodePattern;
  const topicRelevance = strategyKeywords.length
    ? clamp(2 + (uniqueKeywordMatches.size / Math.min(12, strategyKeywords.length)) * 8)
    : clamp(5 + Math.min(5, notesTokens.length / 800));
  const icpAlignment = audienceOverlap.length
    ? clamp(4 + Math.min(6, audienceOverlap.length * 2))
    : clamp(3 + Math.min(5, audienceOverlapInNotes.length));
  const recencyConsistency = clamp(3 + recencySignals * 2.5 + Math.min(3, Math.floor(notesTokens.length / 600)));
  const ctaSynergy = ctaOverlap.length
    ? clamp(4 + Math.min(6, ctaOverlap.length * 2))
    : clamp(3 + Math.min(4, ctaOverlapInNotes.length));
  const brandSuitability = clamp(6 + posToneHits * 1.2 - negToneHits * 2);
  const weights = { topic: 0.35, icp: 0.25, recency: 0.15, cta: 0.15, brand: 0.10 };
  let overall = topicRelevance * weights.topic + icpAlignment * weights.icp + recencyConsistency * weights.recency + ctaSynergy * weights.cta + brandSuitability * weights.brand;
  const avoidTerms = ["explicit", "nsfw", "gambling", "hate speech", "conspiracy"];
  const strongAvoid = countOccurrences(notes, avoidTerms) >= 2;
  const zeroPosSignals = uniqueKeywordMatches.size === 0 && ctaOverlap.length === 0 && audienceOverlap.length === 0;
  const strongAlignment = topicRelevance >= 8 && icpAlignment >= 7.5;
  if (strongAvoid) overall = Math.min(overall, 5.0);
  if (zeroPosSignals) overall = Math.min(overall, 6.5);
  if (strongAlignment) overall = Math.max(overall, 7.5);
  overall = roundToHalf(overall);
  const topTerms = [
    ...Array.from(uniqueKeywordMatches).slice(0, 4),
    ...audienceOverlap.slice(0, 2),
    ...ctaOverlap.slice(0, 2),
    ...tonePositive.slice(0, 1),
  ].filter(Boolean);
  const matches = findMatchesPositions(notes, topTerms, 6);
  const citations = matches.map((m) => quoteAround(notes, m.index)).filter(Boolean).slice(0, 6);
  const rubric_breakdown = [
    { dimension: "Topic relevance", weight: 0.35, raw_score: roundToHalf(topicRelevance), notes: citations[0] ? `Good overlap: "${citations[0]}"` : uniqueKeywordMatches.size ? "Overlapping keywords detected" : "Few direct keyword overlaps" },
    { dimension: "ICP alignment", weight: 0.25, raw_score: roundToHalf(icpAlignment), notes: audienceOverlap.length ? `Audience cues: ${audienceOverlap.slice(0,3).join(", ")}` : "Limited explicit audience cues" },
    { dimension: "Recency/consistency", weight: 0.15, raw_score: roundToHalf(recencyConsistency), notes: recencySignals ? "Recent dates/episodes mentioned" : "No clear recency markers" },
    { dimension: "CTA synergy", weight: 0.15, raw_score: roundToHalf(ctaSynergy), notes: ctaOverlap.length ? `CTA match: ${ctaOverlap.slice(0,3).join(", ")}` : "Generic or absent CTAs" },
    { dimension: "Brand suitability", weight: 0.10, raw_score: roundToHalf(brandSuitability), notes: negToneHits ? "Some tone risks present" : posToneHits ? "Tone seems aligned" : "Neutral tone" },
  ];
  const why_fit: string[] = [];
  if (uniqueKeywordMatches.size) why_fit.push(`Topics align (${uniqueKeywordMatches.size} keyword matches)`);
  if (audienceOverlap.length) why_fit.push(`Audience mentions: ${audienceOverlap.slice(0,3).join(", ")}`);
  if (ctaOverlap.length) why_fit.push(`CTAs compatible: ${ctaOverlap.slice(0,2).join(", ")}`);
  if (posToneHits) why_fit.push("Educational/tactical tone cues");
  const why_not_fit: string[] = [];
  if (!uniqueKeywordMatches.size) why_not_fit.push("Few direct overlaps with campaign topics");
  if (!audienceOverlap.length && audienceOverlapInNotes.length) why_not_fit.push("Audience not clearly aligned with strategy");
  if (!ctaOverlap.length) why_not_fit.push("No strong CTA match to strategy");
  if (negToneHits) why_not_fit.push("Potential tone/brand conflict");
  const recommended_talking_points = [
    audienceOverlap[0] ? `Tailor hooks for ${audienceOverlap[0]} pain points` : "Open with a concrete problem the audience faces",
    uniqueKeywordMatches.size ? "Lean into shared topic intersections from recent episodes" : "Bridge from their recent themes to your core value prop",
    ctaOverlap[0] ? `Echo their CTA style (e.g., "${ctaOverlap[0]}") with your offer` : "Use a single clear CTA that matches episode content",
    "Offer proof (case study/metrics) to increase credibility",
  ];
  const risk_flags = [
    strongAvoid ? "Contains avoid terms (brand risk)" : undefined,
    !uniqueKeywordMatches.size ? "Weak topic alignment" : undefined,
    !ctaOverlap.length ? "CTA mismatch" : undefined,
    negToneHits ? "Tone mismatch risk" : undefined,
  ].filter(Boolean) as string[];
  const signalBuckets = [
    uniqueKeywordMatches.size > 0,
    audienceOverlap.length > 0,
    ctaOverlap.length > 0,
    recencySignals > 0,
  ].filter(Boolean).length;
  let confidence = 0.35 + signalBuckets * 0.12 + Math.min(0.16, notesTokens.length / 6000);
  confidence = Math.max(0.25, Math.min(0.95, confidence));
  return {
    overall_score: overall,
    rubric_breakdown,
    why_fit,
    why_not_fit,
    recommended_talking_points,
    risk_flags,
    citations,
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

    const prompt = `You are evaluating PODCAST_SHOW_NOTES for fit against a minimal CLIENT_PROFILE.
Return JSON only that matches the schema. Use short direct quotes (5–12 words) from the notes where possible. Be specific and concise.
Treat Campaign Strategy and Media Kit URL as high-priority context for tone, CTA synergy, and brand suitability. Be explicit where they influenced the score.

CLIENT_PROFILE (minimal):
- Name: ${name}
- Campaign Strategy: ${campaign_strategy}
- Media Kit URL: ${media_kit_url}

PODCAST_SHOW_NOTES (plain text):
${String(show_notes)}

Considerations:
- Focus on alignment to the campaign strategy: topics, audience, angle, and potential outcomes the client cares about.
- Brand fit: infer tone/values from the strategy; if the media kit URL is provided, reference it as a source of brand guidelines but DO NOT assume you can fetch it.
- CTA synergy: whether typical episode content can naturally lead to the client's desired actions.
- If show notes contain strong misalignment or disqualifiers, explain briefly.

SCORING DIMENSIONS AND WEIGHTS:
- Topic relevance (0.35)
- Audience/ICP alignment (0.25)
- Recency/consistency (0.15)
- CTA synergy (0.15)
- Brand suitability/tone (0.10)

Apply caps/floors:
- strong avoid term → cap 5.0 (explain)
- zero positive signals for strategy alignment → cap 6.5
- strong strategy alignment across topics + audience → floor 7.5
- Round to 0.5.

JSON schema to return:
{
  "overall_score": number,
  "rubric_breakdown": [
    {"dimension": "Topic relevance", "weight": 0.35, "raw_score": 0-10, "notes": "string with 1–2 quotes"},
    {"dimension": "ICP alignment", "weight": 0.25, "raw_score": 0-10, "notes": "string with 1–2 quotes"},
    {"dimension": "Recency/consistency", "weight": 0.15, "raw_score": 0-10, "notes": "string"},
    {"dimension": "CTA synergy", "weight": 0.15, "raw_score": 0-10, "notes": "string"},
    {"dimension": "Brand suitability", "weight": 0.10, "raw_score": 0-10, "notes": "string"}
  ],
  "why_fit": ["bullets with short quotes"],
  "why_not_fit": ["bullets with short quotes"],
  "recommended_talking_points": ["3–5 bullets tailored to client"],
  "risk_flags": ["bullets with brief rationale"],
  "citations": ["short direct phrases pulled from notes (2–6 items)"]
}`;

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

      // Tag with source
      const tagged = { ...data, scored_by: "ai" as const };
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
