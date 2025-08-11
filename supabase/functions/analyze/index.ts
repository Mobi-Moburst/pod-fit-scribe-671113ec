import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS headers for browser access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Basic helpers
const clamp = (n: number, min = 0, max = 10) => Math.max(min, Math.min(max, n));
const roundToHalf = (n: number) => Math.round(n * 2) / 2;

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const STOPWORDS = new Set([
  "the","and","a","an","of","in","on","for","to","with","by","is","are","it","this","that","as","at","be","from","or","we","you","our","your","about","into","how","what","why","when","where","which"
]);

function extractKeywords(text: string): string[] {
  const words = tokenize(text).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 80); // cap to keep it deterministic
}

function countOccurrences(text: string, terms: string[]): number {
  const lower = (text || "").toLowerCase();
  let count = 0;
  for (const t of terms) {
    if (!t) continue;
    // word boundary match to reduce false positives
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
  // shorten to a neat phrase (first sentence-like chunk)
  const dot = snippet.indexOf(". ");
  return (dot > 20 ? snippet.slice(0, dot + 1) : snippet).replace(/\s+/g, " ");
}

serve(async (req) => {
  // CORS preflight
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

    const name: string = client?.name ?? "";
    const campaign_strategy: string = client?.campaign_strategy ?? "";
    const notes: string = String(show_notes || "");

    const notesTokens = tokenize(notes);
    const strategyKeywords = extractKeywords(campaign_strategy);

    // Domain vocabularies
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

    // Compute signals
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

    // Recency / consistency heuristics
    const recentYear = /(202[3-6])/i.test(notes) ? 1 : 0; // crude presence of a recent year
    const monthMention = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.test(notes) ? 1 : 0;
    const episodePattern = /(episode\s*#?\s*\d{1,4}|ep\s*\d{1,4}|season\s*\d{1,2})/i.test(notes) ? 1 : 0;
    const recencySignals = recentYear + monthMention + episodePattern; // 0-3

    // Dimension scoring (0-10)
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

    const weights = {
      topic: 0.35,
      icp: 0.25,
      recency: 0.15,
      cta: 0.15,
      brand: 0.10,
    };

    let overall = topicRelevance * weights.topic
      + icpAlignment * weights.icp
      + recencyConsistency * weights.recency
      + ctaSynergy * weights.cta
      + brandSuitability * weights.brand;

    // Caps / floors
    const avoidTerms = ["explicit", "nsfw", "gambling", "hate speech", "conspiracy"];
    const strongAvoid = countOccurrences(notes, avoidTerms) >= 2;
    const zeroPosSignals = uniqueKeywordMatches.size === 0 && ctaOverlap.length === 0 && audienceOverlap.length === 0;
    const strongAlignment = topicRelevance >= 8 && icpAlignment >= 7.5;

    if (strongAvoid) overall = Math.min(overall, 5.0);
    if (zeroPosSignals) overall = Math.min(overall, 6.5);
    if (strongAlignment) overall = Math.max(overall, 7.5);

    overall = roundToHalf(overall);

    // Build rubric notes with short quotes
    const topTerms = [
      ...Array.from(uniqueKeywordMatches).slice(0, 4),
      ...audienceOverlap.slice(0, 2),
      ...ctaOverlap.slice(0, 2),
      ...tonePositive.slice(0, 1),
    ].filter(Boolean);

    const matches = findMatchesPositions(notes, topTerms, 6);
    const citations = matches.map((m) => quoteAround(notes, m.index)).filter(Boolean).slice(0, 6);

    const rubric_breakdown = [
      {
        dimension: "Topic relevance",
        weight: 0.35,
        raw_score: roundToHalf(topicRelevance),
        notes: citations[0] ? `Good overlap: "${citations[0]}"` : uniqueKeywordMatches.size ? "Overlapping keywords detected" : "Few direct keyword overlaps",
      },
      {
        dimension: "ICP alignment",
        weight: 0.25,
        raw_score: roundToHalf(icpAlignment),
        notes: audienceOverlap.length ? `Audience cues: ${audienceOverlap.slice(0,3).join(", ")}` : "Limited explicit audience cues",
      },
      {
        dimension: "Recency/consistency",
        weight: 0.15,
        raw_score: roundToHalf(recencyConsistency),
        notes: recencySignals ? "Recent dates/episodes mentioned" : "No clear recency markers",
      },
      {
        dimension: "CTA synergy",
        weight: 0.15,
        raw_score: roundToHalf(ctaSynergy),
        notes: ctaOverlap.length ? `CTA match: ${ctaOverlap.slice(0,3).join(", ")}` : "Generic or absent CTAs",
      },
      {
        dimension: "Brand suitability",
        weight: 0.10,
        raw_score: roundToHalf(brandSuitability),
        notes: negToneHits ? "Some tone risks present" : posToneHits ? "Tone seems aligned" : "Neutral tone",
      },
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

    // Confidence: based on signal diversity + notes length
    const signalBuckets = [
      uniqueKeywordMatches.size > 0,
      audienceOverlap.length > 0,
      ctaOverlap.length > 0,
      recencySignals > 0,
    ].filter(Boolean).length;
    let confidence = 0.35 + signalBuckets * 0.12 + Math.min(0.16, notesTokens.length / 6000);
    confidence = Math.max(0.25, Math.min(0.95, confidence));

    const data = {
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

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Analyze local error", e);
    return new Response(
      JSON.stringify({ success: false, error: "Analyze error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
