import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------- Utilities ----------------
const clamp = (n: number, min = 0, max = 10) => Math.max(min, Math.min(max, n));
const roundToHalf = (n: number) => Math.round(n * 2) / 2;
const norm = (s: string) => (s || "").toLowerCase();
function tokenize(s: string): string[] {
  return norm(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
const STOP = new Set(["the","and","a","an","of","in","on","for","to","with","by","is","are","it","this","that","as","at","be","from","or","we","you","our","your","about","into","how","what","why","when","where","which"]);
function keywords(text: string): string[] {
  const words = tokenize(text).filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(words)].slice(0, 120);
}
function esc(re: string) {
  return re.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
function count(text: string, terms: string[]): number {
  const lower = norm(text);
  let c = 0;
  for (const t of terms) {
    if (!t) continue;
    const m = lower.match(new RegExp(`\\b${esc(t)}\\b`, "g"));
    c += m ? m.length : 0;
  }
  return c;
}
function findPositions(text: string, terms: string[], max = 12) {
  const lower = norm(text);
  const out: { term: string; index: number }[] = [];
  for (const t of terms) {
    if (!t) continue;
    const re = new RegExp(`\\b${esc(t)}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      out.push({ term: t, index: m.index });
      if (out.length >= max) return out;
    }
  }
  return out;
}
function quoteAround(text: string, idx: number, radius = 70) {
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
function isGenericSlogan(q: string) {
  const l = norm(q);
  return /thought leader|leaders in|trailblazing|cutting-edge|unlock potential|empower|innovation hub|join us/i.test(l);
}

// ---------------- Concept Set Expansion ----------------
function expandConcepts(client: any) {
  const talking: string[] = (client?.talking_points || client?.keywords_positive || []) as string[];
  const audiences: string[] = (client?.target_audiences || client?.target_roles || []) as string[];

  const strong = new Set<string>();
  const near = new Set<string>();

  const add = (arr: string[], target: Set<string>) => arr.forEach((x) => x && target.add(norm(x)));

  const pushStrong = (terms: string[]) => add(terms, strong);
  const pushNear = (terms: string[]) => add(terms, near);

  const pushCommonSecurity = () => {
    pushStrong(["identity","zero trust","compliance","governance","iam","mfa","sso","data security","endpoint security","soc","siem","detection","threat","incident response","risk"]);
    pushNear(["okta","entra","azure ad","active directory","microsoft","azure","m365","office 365","defender","splunk","crowdstrike","aws","gcp","google cloud","snowflake"]);
  };

  const pushCriticalInfra = () => {
    pushStrong(["critical infrastructure","utilities","grid","power","energy","oil","gas","manufacturing","operational technology","ot","ics","scada","nerc","nerc cip"]);
  };

  const pushAIGov = () => {
    pushStrong(["ai governance","model risk","responsible ai","compliance","policy","audit","regulated industries","privacy"]);
    pushNear(["ml governance","model monitoring","evaluation","alignment"]);
  };

  const allSeeds = [...talking, ...audiences];
  for (const seed of allSeeds) {
    const s = norm(seed);
    if (!s) continue;
    // Always include the seed itself
    pushStrong([s]);

    // Heuristic expansions
    if (/microsoft|entra|azure|m365|office\s*365|defender/.test(s)) {
      pushStrong(["microsoft","azure","entra","m365","office 365","defender"]);
      pushNear(["active directory","azure ad","aad","intune","sharepoint","onedrive","copilot"]);
      pushCommonSecurity();
    }
    if (/identity|zero\s*trust|iam|sso|mfa/.test(s)) {
      pushCommonSecurity();
    }
    if (/security|siem|soc|xdr|detection|threat|governance|compliance/.test(s)) {
      pushCommonSecurity();
    }
    if (/critical\s*infrastructure|utilities|grid|ot|ics|scada|nerc/.test(s)) {
      pushCriticalInfra();
    }
    if (/ai\s*governance|responsible\s*ai|model\s*risk/.test(s)) {
      pushAIGov();
    }
    if (/cloud|data|warehouse|analytics/.test(s)) {
      pushNear(["aws","amazon web services","gcp","google cloud","snowflake","databricks","bigquery","redshift"]);
    }
    if (/enterprise|b2b|it|ciso|cio|security\s*leaders|platform\s*teams/.test(s)) {
      pushNear(["enterprise","b2b","ciso","cio","platform team","secops","it operations","cto","vp security"]);
    }
  }

  // Remove duplicates that collide between sets
  for (const t of strong) near.delete(t);

  return { strong: [...strong], near: [...near] };
}

// ---------------- Heuristic Scorer (Goal-centric) ----------------
function scoreGoalCentric(client: any, show_notes: string) {
  const notes: string = String(show_notes || "");
  const tokens = tokenize(notes);
  const { strong, near } = expandConcepts(client);
  const audiences: string[] = (client?.target_audiences || client?.target_roles || []) as string[];
  const avoids: string[] = (client?.avoid || client?.keywords_negative || []) as string[];
  const notesPref: string = String(client?.notes || client?.campaign_strategy || "");
  const mediaKitUrl: string = String(client?.media_kit_url || "");

  // Concept hits
  const strongHits = findPositions(notes, strong).slice(0, 10);
  const nearHits = findPositions(notes, near).slice(0, 10);
  const distinctConcepts = new Set([...strongHits.map(h => h.term), ...nearHits.map(h => h.term)]).size;
  const weightedConceptScore = clamp(Math.min(10, strongHits.length * 2 + nearHits.length * 1));

  // Topic relevance (0.35)
  const topicRelevance = roundToHalf(clamp(2 + weightedConceptScore * 0.5));

  // ICP alignment (0.25): ANY primary or adjacent audience is enough; diminishing returns
  const audStrong = findPositions(notes, audiences.map(norm)).length;
  const audAdj = nearHits.filter(h => audiences.some(a => norm(h.term).includes(norm(a)))).length;
  const icpAlignment = roundToHalf(clamp(2 + Math.min(7, audStrong * 2 + Math.min(2, audAdj * 0.5))));

  // Recency/consistency (0.15)
  const recentYear = /(202[3-6])/.test(notes) ? 1 : 0;
  const monthMention = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.test(notes) ? 1 : 0;
  const cadence = /(episode\s*#?\s*\d{1,4}|season\s*\d{1,2}|weekly|biweekly|monthly)/i.test(notes) ? 1 : 0;
  const recencyConsistency = roundToHalf(clamp(2 + (recentYear + monthMention + cadence) * 2 + Math.min(2, Math.floor(tokens.length / 800))));

  // CTA synergy (0.15)
  const ctaTerms = ["book","demo","consult","download","guide","report","contact","learn more","talk to","sales","trial","start"];
  const ctaOverlap = count(notes, ctaTerms);
  const enterpriseVibe = /(enterprise|b2b|ciso|cio|governance|compliance|risk|security)/i.test(notes) ? 1 : 0;
  const ctaSynergy = roundToHalf(clamp(2 + Math.min(7, ctaOverlap * 1.5 + enterpriseVibe * 2)));

  // Brand suitability (0.10)
  const tonePref = norm(notesPref);
  const tonePos = ["authoritative","technical","tactical","educational","interview","case study","no pay-to-play"].filter(t => tonePref.includes(t)).length;
  const toneNegInNotes = /(explicit|nsfw|politics|gambling|hype|clickbait)/i.test(notes) ? 1 : 0;
  const brandSuitability = roundToHalf(clamp(4 + tonePos * 1.2 - toneNegInNotes * 2));

  // Combine
  const weights = { topic: 0.35, icp: 0.25, recency: 0.15, cta: 0.15, brand: 0.10 } as const;
  let overall = topicRelevance * weights.topic + icpAlignment * weights.icp + recencyConsistency * weights.recency + ctaSynergy * weights.cta + brandSuitability * weights.brand;

  // Genericness penalty: if we cannot surface at least 2 specific evidence snippets, reduce slightly
  const penaltyTerms = [...new Set([...strongHits.map(h => h.term), ...nearHits.map(h => h.term)])];
  const penaltyPositions = findPositions(notes, penaltyTerms, 6);
  if (penaltyPositions.length <= 1) {
    overall -= 0.5; // push weak cases down toward the 1–4 range
  }

  // Caps & floors (recalibrated)
  const avoidCounts = avoids.map(a => ({ a, c: count(notes, [a]) })).sort((x,y)=>y.c - x.c);
  const strongAvoidCentral = avoidCounts[0]?.c >= 2; // heuristic: central if repeated
  const zeroConceptOverlap = (strongHits.length + nearHits.length) === 0;
  const strongAudienceEvidence = audStrong >= 1 || audAdj >= 2;
  const threeDistinctConcepts = distinctConcepts >= 3;

  if (strongAvoidCentral) overall = Math.min(overall, 5.0);
  if (zeroConceptOverlap) overall = Math.min(overall, 4.0);
  if (threeDistinctConcepts && strongAudienceEvidence) overall = Math.max(overall, 8.0);
  overall = roundToHalf(clamp(overall, 0, 10));

  // Evidence extraction (prefer non-generic)
  const evidenceTerms = [
    ...strongHits.slice(0, 6).map(h => h.term),
    ...nearHits.slice(0, 6).map(h => h.term),
  ];
  const positions = findPositions(notes, evidenceTerms, 12);
  const quotes = positions
    .map((p) => quoteAround(notes, p.index))
    .filter((q) => q && !isGenericSlogan(q))
    .slice(0, 6);
  const citations = quotes.length ? quotes : keywords(notes).slice(0, 6);

  // Why fit (CLAIM → EVIDENCE → INTERPRETATION)
  const why_fit_structured = [] as { claim: string; evidence: string; interpretation: string }[];
  if (strongHits.length) why_fit_structured.push({
    claim: "Strong topic overlap",
    evidence: quotes[0] || strongHits[0]?.term || "",
    interpretation: "Maps directly to priority themes and enterprise use cases",
  });
  if (strongAudienceEvidence) why_fit_structured.push({
    claim: "Audience alignment present",
    evidence: quotes[1] || audiences[0] || "",
    interpretation: "Signals enterprise/regulated decision-makers consistent with target ICP",
  });
  if (enterpriseVibe) why_fit_structured.push({
    claim: "CTA-friendly enterprise tone",
    evidence: quotes[2] || "enterprise/compliance cues",
    interpretation: "Supports demo/consult/guide-style CTA for B2B motion",
  });

  // Why not fit (severity + triad)
  const why_not_fit_structured: { severity: 'Critical' | 'Major' | 'Minor'; claim: string; evidence: string; interpretation: string }[] = [];
  if (strongAvoidCentral) {
    why_not_fit_structured.push({
      severity: 'Critical',
      claim: `Contains avoid term: "${avoidCounts[0].a}"`,
      evidence: quotes[3] || avoidCounts[0].a,
      interpretation: "Central to episode; brand/scope conflict",
    });
  }
  if (zeroConceptOverlap) {
    why_not_fit_structured.push({
      severity: 'Major',
      claim: 'No overlap with concept sets',
      evidence: 'No relevant terms detected',
      interpretation: 'Topic/theme mismatch; low relevance',
    });
  }
  if (!strongAudienceEvidence) {
    why_not_fit_structured.push({
      severity: 'Minor',
      claim: 'Audience specificity is weak',
      evidence: 'Lacks clear role/industry cues',
      interpretation: 'Proceed only if host confirms ICP details',
    });
  }

  // Risk flags (tag + mitigation)
  const risk_flags_structured: { severity: 'Critical' | 'Major' | 'Minor'; flag: string; mitigation: string }[] = [];
  if (/(sponsored by|paid placement|advertorial|pay to play)/i.test(notes)) {
    risk_flags_structured.push({ severity: 'Major', flag: 'Pay-to-play indications', mitigation: 'Confirm editorial policy or negotiate earned placement' });
  }
  if (strongAvoidCentral) {
    risk_flags_structured.push({ severity: 'Critical', flag: `Avoid term prominent: ${avoidCounts[0].a}`, mitigation: 'Pick a different episode or angle; avoid brand conflict' });
  }

  // Simple talking points to pitch (tie to themes)
  const recommended_talking_points = [
    strongHits[0]?.term ? `Lead with ${strongHits[0].term} and enterprise risk` : 'Lead with concrete enterprise risk/use case',
    enterpriseVibe ? 'Offer a short demo tied to the episode theme' : 'Offer a pragmatic guide/checklist as CTA',
    strongAudienceEvidence ? 'Map benefits to CISO/CIO/OT ops outcomes' : 'Request ICP confirmation (role/industry) before pitching',
  ];

  // Confidence
  let confidence = 0.5 + Math.min(0.2, tokens.length / 6000) + (quotes.length ? 0.1 : 0) - (!mediaKitUrl ? 0.1 : 0);
  confidence = Math.max(0.25, Math.min(0.95, confidence));
  const confidence_label = confidence >= 0.75 ? 'High' : confidence >= 0.5 ? 'Med' : 'Low';
  const confidence_note = `${quotes.length} usable quotes; notes ${tokens.length} tokens; media kit ${mediaKitUrl ? 'present' : 'missing'}`;

  // Verdict policy
  const hasCritical = why_not_fit_structured.some(w => w.severity === 'Critical') || risk_flags_structured.some(r => r.severity === 'Critical');
  const verdict = hasCritical ? 'not_recommended' : overall >= 7.5 ? 'recommend' : overall < 6.0 ? 'not_recommended' : 'consider';
  const verdict_reason = verdict === 'recommend'
    ? 'Strong thematic and audience alignment with low risk'
    : verdict === 'consider'
      ? 'Partial alignment; proceed if a condition is met'
      : 'Low alignment or critical blocker present';

  // What would change the verdict
  const what_would_change = [] as string[];
  if (!strongAudienceEvidence) what_would_change.push('If host confirms ICP (role/industry) relevance');
  if (zeroConceptOverlap) what_would_change.push('If recent episodes show recurring relevant themes');

  // Legacy fallbacks
  const why_fit = why_fit_structured.map(w => `${w.claim} — "${w.evidence}" (${w.interpretation})`).slice(0, 5);
  const why_not_fit = why_not_fit_structured.map(w => `${w.claim} [${w.severity}] — "${w.evidence}" (${w.interpretation})`).slice(0, 4);
  const risk_flags = risk_flags_structured.map(r => `${r.flag} [${r.severity}]`);

  // Build summary (140–200 words)
  const summary_text = buildSummary({ overall: overall, verdict, why_fit_structured, why_not_fit_structured, risk_flags_structured, clientName: client?.name || client?.company || 'the client' });

  // Rubric breakdown to explain scores
  const rubric_breakdown = [
    { dimension: 'Topic relevance', weight: 0.35, raw_score: topicRelevance, notes: strongHits[0]?.term ? `Concept hits include: ${[...new Set(strongHits.slice(0,3).map(h=>h.term))].join(', ')}` : 'Limited explicit overlap; used near-matches' },
    { dimension: 'ICP alignment', weight: 0.25, raw_score: icpAlignment, notes: strongAudienceEvidence ? 'ICP cues detected' : 'ICP weak/implicit' },
    { dimension: 'Recency/consistency', weight: 0.15, raw_score: recencyConsistency, notes: (/(202[3-6])/i.test(notes) ? 'Recent' : 'No recency cues') },
    { dimension: 'CTA synergy', weight: 0.15, raw_score: ctaSynergy, notes: enterpriseVibe ? 'Enterprise CTA likely' : 'Generic CTA vibe' },
    { dimension: 'Brand suitability', weight: 0.10, raw_score: brandSuitability, notes: toneNegInNotes ? 'Tone risks present' : 'Tone neutral/ok' },
  ];

  return {
    overall_score: overall,
    rubric_breakdown,
    // legacy
    why_fit,
    why_not_fit,
    recommended_talking_points,
    risk_flags,
    citations,
    scored_by: 'local-heuristic' as const,
    confidence,
    // new
    verdict,
    verdict_reason,
    why_fit_structured,
    why_not_fit_structured,
    risk_flags_structured,
    confidence_label,
    confidence_note,
    what_would_change,
    summary_text,
  };
}

function buildSummary(args: {
  overall: number;
  verdict: 'recommend' | 'consider' | 'not_recommended';
  why_fit_structured: { claim: string; evidence: string; interpretation: string }[];
  why_not_fit_structured: { severity: 'Critical' | 'Major' | 'Minor'; claim: string; evidence: string; interpretation: string }[];
  risk_flags_structured: { severity: 'Critical' | 'Major' | 'Minor'; flag: string; mitigation: string }[];
  clientName: string;
}) {
  const parts: string[] = [];
  const verdictText = args.verdict === 'recommend' ? 'Recommend' : args.verdict === 'consider' ? 'Consider' : 'Not recommended';
  parts.push(`${verdictText} (${args.overall.toFixed(1)}/10).`);
  const fit = args.why_fit_structured.slice(0, 3).map(i => `${i.claim} — "${i.evidence}" ${i.interpretation ? `(${i.interpretation})` : ''}`).join(' ');
  if (fit) parts.push(fit);
  const risks = args.why_not_fit_structured.slice(0, 2).map(r => `${r.claim} [${r.severity}] — "${r.evidence}"`).join(' ');
  if (risks) parts.push(risks);
  const flags = args.risk_flags_structured.slice(0, 2).map(f => `${f.flag} [${f.severity}]`).join('; ');
  if (flags) parts.push(`Risks: ${flags}.`);
  const nextStep = args.verdict === 'recommend'
    ? `Next step: pitch ${args.clientName} with a tailored angle tied to the strongest detected theme.`
    : args.verdict === 'consider'
      ? `Next step: proceed only if a condition is met (e.g., confirm ICP or recurring theme).`
      : `Next step: skip, or target a different episode/show with clearer ICP and theme alignment.`;
  parts.push(nextStep);
  // Ensure ~140–200 words by trimming if needed
  let text = parts.join(' ');
  if (text.length > 1200) text = text.slice(0, 1200);
  return text;
}

// ---------------- HTTP handler ----------------
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

    if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim()) {
      const data = { ...scoreGoalCentric(client, String(show_notes || "")), fallback_reason: "Missing OPENAI_API_KEY" };
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build goal-centric prompt
    const prompt = `Upgrade the evaluator to be goal-centric and non-literal. Follow these rules strictly and return JSON matching the schema only.\n\nINTENT: Judge overall campaign fit for the client, not token matches. Accept strong adjacencies.\n\nREASONING RULES:\n1) Concept sets & near matches: Expand each talking_point and target_audience into concept sets (synonyms/adjacent terms). Score best match, not count of exact tokens.\n2) Coverage logic: ANY primary audience or strong adjacent yields positive ICP credit; diminishing returns for extras. Only mark missing if none present.\n3) Evidence extraction: Prefer quotes that reference audience/use cases/industries/risks/compliance/identity/OT-IT; reject generic slogans.\n4) Scoring (weights unchanged): topic 0.35, icp 0.25, recency 0.15, cta 0.15, brand 0.10.\n5) Caps & floors: strong avoid central ⇒ cap 5.0; zero concept overlap ⇒ cap 6.5; ≥3 concept hits AND strong audience evidence ⇒ floor 7.5. Round to 0.5.\n6) Verdict policy: Recommend ≥7.5 & no critical blockers; Consider 6.0–7.0 or ≥7.5 with minor gap; Not recommended <6.0 or any critical blocker.\n7) Output sections: structured triads and tags.\n\nCLIENT:\n- Name: ${client?.name ?? ''}\n- Company: ${client?.company ?? ''}\n- Media Kit: ${client?.media_kit_url ?? ''}\n- Target Audiences: ${(client?.target_audiences || []).join(', ')}\n- Talking Points: ${(client?.talking_points || []).join(', ')}\n- Avoid: ${(client?.avoid || []).join(', ')}\n- Notes: ${client?.notes ?? ''}\n\nSHOW NOTES (plain text):\n${String(show_notes)}\n\nReturn JSON only with this schema:\n{\n  "overall_score": number,\n  "rubric_breakdown": [\n    {"dimension":"Topic relevance","weight":0.35,"raw_score":0-10,"notes":"short; may include 1 quote"},\n    {"dimension":"ICP alignment","weight":0.25,"raw_score":0-10,"notes":"short; may include 1 quote"},\n    {"dimension":"Recency/consistency","weight":0.15,"raw_score":0-10,"notes":"short"},\n    {"dimension":"CTA synergy","weight":0.15,"raw_score":0-10,"notes":"short"},\n    {"dimension":"Brand suitability","weight":0.10,"raw_score":0-10,"notes":"short"}\n  ],\n  "why_fit_structured": [{"claim":"","evidence":"short quote","interpretation":""}],\n  "why_not_fit_structured": [{"severity":"Critical|Major|Minor","claim":"","evidence":"short quote","interpretation":""}],\n  "risk_flags_structured": [{"severity":"Critical|Major|Minor","flag":"","mitigation":""}],\n  "recommended_talking_points": ["3–5 bullets"],\n  "citations": ["2–6 short quotes"],\n  "verdict": "recommend|consider|not_recommended",\n  "verdict_reason": "one sentence",\n  "confidence": 0-1,\n  "confidence_label": "High|Med|Low",\n  "confidence_note": "data quality note",\n  "what_would_change": ["1–2 concrete checks"],\n  "summary_text": "140–200 words"
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
    const t = setTimeout(() => controller.abort(), 22000);
    let json: any = null;

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(t);

      try { json = await resp.json(); } catch {}
      if (!resp.ok) {
        const errMsg = json?.error?.message || resp.statusText || `status ${resp.status}`;
        const data = { ...scoreGoalCentric(client, String(show_notes || "")), fallback_reason: `OpenAI API error: ${errMsg}` };
        return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const text = json?.choices?.[0]?.message?.content || "";
      let data: any = null;
      let cleaned = (text || "").trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
      try { data = JSON.parse(cleaned); } catch {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try { data = JSON.parse(cleaned.slice(start, end + 1)); } catch {}
        }
      }
      if (!data) {
        const fb = { ...scoreGoalCentric(client, String(show_notes || "")), fallback_reason: "LLM returned invalid JSON" };
        return new Response(JSON.stringify({ success: true, data: fb }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Post-process AI result: enforce caps/floors and ensure required fields
      const notesText = String(show_notes || "");
      const expanded = expandConcepts(client);
      const conceptOverlap = (findPositions(notesText, expanded.strong).length + findPositions(notesText, expanded.near).length) > 0;
      const avoids: string[] = (client?.avoid || []) as string[];
      const avoidCounts = avoids.map(a => ({ a, c: count(notesText, [a]) })).sort((x,y)=>y.c - x.c);
      const strongAvoidCentral = avoidCounts[0]?.c >= 2;

      let adjusted = Number(data?.overall_score) || 0;
      if (strongAvoidCentral) adjusted = Math.min(adjusted, 5.0);
      if (!conceptOverlap) adjusted = Math.min(adjusted, 4.0);
      // Floor if strong evidence present
      const aud: string[] = (client?.target_audiences || []) as string[];
      const audStrong = findPositions(notesText, aud.map(norm)).length;
      const nearHits = findPositions(notesText, expanded.near).length;
      if (expanded.strong.length >= 3 && (audStrong >= 1 || nearHits >= 2)) adjusted = Math.max(adjusted, 8.0);
      adjusted = roundToHalf(clamp(adjusted, 0, 10));

      const ensureArray = (v: any) => Array.isArray(v) ? v : [];
      const why_fit_structured = ensureArray(data?.why_fit_structured);
      const why_not_fit_structured = ensureArray(data?.why_not_fit_structured);
      const risk_flags_structured = ensureArray(data?.risk_flags_structured);

      // Derive legacy arrays for UI compatibility
      const why_fit = why_fit_structured.map((w: any) => `${w.claim} — "${w.evidence}" (${w.interpretation})`).slice(0, 5);
      const why_not_fit = why_not_fit_structured.map((w: any) => `${w.claim} [${w.severity}] — "${w.evidence}" (${w.interpretation})`).slice(0, 4);
      const risk_flags = risk_flags_structured.map((r: any) => `${r.flag} [${r.severity}]`);

      // Verdict if missing
      const hasCritical = why_not_fit_structured.some((w: any) => w.severity === 'Critical') || risk_flags_structured.some((r: any) => r.severity === 'Critical');
      const verdict: 'recommend' | 'consider' | 'not_recommended' = hasCritical ? 'not_recommended' : adjusted >= 7.5 ? 'recommend' : adjusted < 6.0 ? 'not_recommended' : 'consider';
      const confidence_label = data?.confidence_label || ((Number(data?.confidence) || 0.5) >= 0.75 ? 'High' : (Number(data?.confidence) || 0.5) >= 0.5 ? 'Med' : 'Low');
      const confidence_note = data?.confidence_note || `${(data?.citations || []).length} usable quotes`;

      const merged = {
        overall_score: adjusted,
        rubric_breakdown: data?.rubric_breakdown || [],
        why_fit,
        why_not_fit,
        recommended_talking_points: ensureArray(data?.recommended_talking_points),
        risk_flags,
        citations: ensureArray(data?.citations),
        scored_by: 'ai' as const,
        confidence: typeof data?.confidence === 'number' ? data.confidence : undefined,
        // new
        verdict: verdict,
        verdict_reason: data?.verdict_reason || undefined,
        why_fit_structured,
        why_not_fit_structured,
        risk_flags_structured,
        confidence_label,
        confidence_note,
        what_would_change: ensureArray(data?.what_would_change).slice(0,2),
        summary_text: data?.summary_text || undefined,
      };

      // If summary missing, synthesize
      if (!merged.summary_text) {
        merged.summary_text = buildSummary({
          overall: merged.overall_score,
          verdict: merged.verdict!,
          why_fit_structured: merged.why_fit_structured || [],
          why_not_fit_structured: merged.why_not_fit_structured || [],
          risk_flags_structured: merged.risk_flags_structured || [],
          clientName: client?.name || client?.company || 'the client',
        });
      }

      return new Response(JSON.stringify({ success: true, data: merged }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      clearTimeout(t);
      const data = { ...scoreGoalCentric(client, String(show_notes || "")), fallback_reason: (e as any)?.message || 'LLM call failed' };
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (_e) {
    return new Response(
      JSON.stringify({ success: false, error: "Analyze error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
