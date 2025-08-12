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

  const pushEducation = () => {
    pushStrong(["k-12","k12","education","educators","teacher","teachers","classroom","curriculum","standards","stem","steam","project-based learning","pedagogy","literacy","numeracy","principal","superintendent","district","school","edtech","professional development","lesson plan","assessment"]);
    pushNear(["students","parent","pta","grants","foundation","nonprofit","after-school","maker","labs","science fair","math","science","technology","engineering"]);
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
    if (/identity|zero\s*trust|iam|sso|mfa/.test(s)) { pushCommonSecurity(); }
    if (/security|siem|soc|xdr|detection|threat|governance|compliance/.test(s)) { pushCommonSecurity(); }
    if (/critical\s*infrastructure|utilities|grid|ot|ics|scada|nerc/.test(s)) { pushCriticalInfra(); }
    if (/ai\s*governance|responsible\s*ai|model\s*risk/.test(s)) { pushAIGov(); }
    if (/cloud|data|warehouse|analytics/.test(s)) { pushNear(["aws","amazon web services","gcp","google cloud","snowflake","databricks","bigquery","redshift"]); }
    if (/enterprise|b2b|it|ciso|cio|security\s*leaders|platform\s*teams/.test(s)) { pushNear(["enterprise","b2b","ciso","cio","platform team","secops","it operations","cto","vp security"]); }

    // Education / K-12 expansions
    if (/k-?12|education|teacher|classroom|curriculum|stem|principal|superintendent|district|school|edtech|students|pedagogy|lesson|assessment/.test(s)) {
      pushEducation();
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
  const strongHits = findPositions(notes, strong).slice(0, 20);
  const nearHits = findPositions(notes, near).slice(0, 20);
  const conceptHitsCount = strongHits.length + nearHits.length;
  const distinctConcepts = new Set([...strongHits.map(h => h.term), ...nearHits.map(h => h.term)]).size;

  // Evidence quotes (prefer non-generic)
  const evidenceTerms = [
    ...strongHits.slice(0, 8).map(h => h.term),
    ...nearHits.slice(0, 8).map(h => h.term),
  ];
  const positions = findPositions(notes, evidenceTerms, 16);
  const rawQuotes = positions.map((p) => quoteAround(notes, p.index));
  const nonGenericQuotes = rawQuotes.filter((q) => q && !isGenericSlogan(q)).slice(0, 8);
  const citations = nonGenericQuotes.length ? nonGenericQuotes.slice(0, 6) : keywords(notes).slice(0, 6);

  // Topic relevance (0.35)
  const weightedConceptScore = clamp(Math.min(10, strongHits.length * 2 + nearHits.length * 1));
  const topicRelevance = roundToHalf(clamp(2 + weightedConceptScore * 0.5));

  // ICP alignment (0.25)
  const audStrong = findPositions(notes, audiences.map(norm)).length;
  const audAdj = nearHits.filter(h => audiences.some(a => norm(h.term).includes(norm(a)))).length;
  const icpAlignment = roundToHalf(clamp(2 + Math.min(7, audStrong * 2 + Math.min(2, audAdj * 0.5))));

  // Recency/consistency (0.15)
  const recentYear = /(202[3-6])/.test(notes) ? 1 : 0;
  const monthMention = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.test(notes) ? 1 : 0;
  const cadenceEpisode = /(episode\s*#?\s*\d{1,4})/i.test(notes) ? 1 : 0;
  const cadenceSeason = /(season\s*\d{1,2})/i.test(notes) ? 1 : 0;
  const cadenceWeekly = /(weekly|biweekly|monthly)/i.test(notes) ? 1 : 0;
  const recencyConsistency = roundToHalf(clamp(2 + (recentYear + monthMention + (cadenceEpisode+cadenceSeason+cadenceWeekly>0?1:0)) * 2 + Math.min(2, Math.floor(tokens.length / 800))));

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

  // Weighted mean (recency removed). New weights normalized to 1.0
  const weights = { topic: 0.41, icp: 0.29, cta: 0.18, brand: 0.12 } as const;
  const weighted_mean = topicRelevance * weights.topic + icpAlignment * weights.icp + ctaSynergy * weights.cta + brandSuitability * weights.brand;

  // Adjustments
  const applied_adjustments: { type: 'cap'|'floor'|'penalty'|'bonus'; label: string; amount?: number }[] = [];
  let adj_genericness = 0;
  const nonGenericCount = nonGenericQuotes.length;
  if (nonGenericCount <= 0) { adj_genericness = -1.5; }
  else if (nonGenericCount === 1) { adj_genericness = -1.0; }
  else if (nonGenericCount === 2) { adj_genericness = -0.5; }
  if (adj_genericness) applied_adjustments.push({ type: 'penalty', label: 'Genericness', amount: adj_genericness });

  let adj_multi_concept = 0;
  if (distinctConcepts >= 5) adj_multi_concept = +0.5;
  else if (distinctConcepts >= 3) adj_multi_concept = +0.3;
  if (adj_multi_concept) applied_adjustments.push({ type: 'bonus', label: 'Multi-concept', amount: adj_multi_concept });

  // Cadence bonus removed per new policy
  const adj_cadence = 0;

  let overall = clamp(weighted_mean + adj_genericness + adj_multi_concept, 0, 10);

  // Caps (evidence-gated, apply at most one)
  const avoidCounts = avoids.map(a => ({ a, c: count(notes, [a]) })).sort((x,y)=>y.c - x.c);
  const strongAvoidCentral = (avoidCounts[0]?.c || 0) >= 2;
  const payToPlayMatch = notes.match(/(sponsored by|paid placement|advertorial|pay\s*to\s*play)/i);
  const linkBanMatch = notes.match(/(no\s+links|do\s+not\s+include\s+links|don['’]t\s+include\s+urls|no\s+urls)/i);
  const consumerCue = /(giveaway|coupon|subscribe and save|lifestyle|beauty|fashion|fitness|cooking|parenting|celebrity|gossip)/i.test(notes);
  const b2cMismatch = consumerCue && !enterpriseVibe;

  let cap_applied = false;
  let cap_type: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'none' = 'none';
  let cap_evidence = '';
  let cap_reason: string | undefined;

  const tryApplyCap = (type: typeof cap_type, evidence: string) => {
    if (cap_applied) return;
    cap_applied = true; cap_type = type; cap_evidence = evidence || ''; overall = Math.min(overall, 5.0);
    applied_adjustments.push({ type: 'cap', label: `${type.replace(/_/g,' ')}`, amount: 5.0 });
    cap_reason = `${type.replace(/_/g,' ')} — "${evidence || 'evidence required'}"`;
  };

  if (strongAvoidCentral) {
    tryApplyCap('avoid', avoidCounts[0].a);
  } else if (payToPlayMatch) {
    tryApplyCap('pay_to_play', payToPlayMatch[0]);
  } else if (linkBanMatch) {
    tryApplyCap('link_ban', linkBanMatch[0]);
  } else if (b2cMismatch) {
    tryApplyCap('b2c_mismatch', 'consumer-only cues without enterprise signals');
  } else if (conceptHitsCount === 0 && topicRelevance <= 5.0) {
    tryApplyCap('zero_overlap', 'No relevant terms detected');
  }

  // Calibration invariants
  const criticalCap = cap_applied && (cap_type === 'avoid' || cap_type === 'pay_to_play' || cap_type === 'link_ban' || cap_type === 'b2c_mismatch' || cap_type === 'zero_overlap');
  if (!criticalCap && topicRelevance >= 8 && icpAlignment >= 7 && brandSuitability >= 7) {
    overall = Math.max(overall, 7.0);
  }
  if (!criticalCap && overall < (weighted_mean - 2.0)) {
    overall = weighted_mean - 2.0;
  }

  overall = roundToHalf(clamp(overall, 0, 10));

  // Evidence blocks
  const why_fit_structured = [] as { claim: string; evidence: string; interpretation: string }[];
  if (strongHits.length) why_fit_structured.push({
    claim: "Strong topic overlap",
    evidence: nonGenericQuotes[0] || strongHits[0]?.term || "",
    interpretation: "Maps directly to priority themes and enterprise use cases",
  });
  const strongAudienceEvidence = audStrong >= 1 || audAdj >= 2;
  if (strongAudienceEvidence) why_fit_structured.push({
    claim: "Audience alignment present",
    evidence: nonGenericQuotes[1] || audiences[0] || "",
    interpretation: "Signals enterprise/regulated decision-makers consistent with target ICP",
  });
  if (enterpriseVibe) why_fit_structured.push({
    claim: "CTA-friendly enterprise tone",
    evidence: nonGenericQuotes[2] || "enterprise/compliance cues",
    interpretation: "Supports demo/consult/guide-style CTA for B2B motion",
  });

  const why_not_fit_structured: { severity: 'Critical' | 'Major' | 'Minor'; claim: string; evidence: string; interpretation: string }[] = [];
  if (cap_type === 'avoid') {
    why_not_fit_structured.push({ severity: 'Critical', claim: `Contains avoid term: "${avoidCounts[0].a}"`, evidence: cap_evidence || avoidCounts[0].a, interpretation: 'Central to episode; brand/scope conflict' });
  }
  if (cap_type === 'pay_to_play') {
    why_not_fit_structured.push({ severity: 'Critical', claim: 'Pay-to-play indications', evidence: cap_evidence || 'sponsored by', interpretation: 'Editorial independence risk' });
  }
  if (cap_type === 'link_ban') {
    why_not_fit_structured.push({ severity: 'Major', claim: 'Link ban present', evidence: cap_evidence, interpretation: 'Limits CTA effectiveness' });
  }
  if (cap_type === 'b2c_mismatch') {
    why_not_fit_structured.push({ severity: 'Major', claim: 'B2C mismatch', evidence: cap_evidence, interpretation: 'Consumer-focused content misaligned with enterprise ICP' });
  }
  if (cap_type === 'zero_overlap') {
    why_not_fit_structured.push({ severity: 'Major', claim: 'No overlap with concept sets', evidence: 'No relevant terms detected', interpretation: 'Topic/theme mismatch; low relevance' });
  }
  if (!strongAudienceEvidence) {
    why_not_fit_structured.push({ severity: 'Minor', claim: 'Audience specificity is weak', evidence: 'Lacks clear role/industry cues', interpretation: 'Proceed only if host confirms ICP details' });
  }

  // Risk flags
  const risk_flags_structured: { severity: 'Critical' | 'Major' | 'Minor'; flag: string; mitigation: string }[] = [];
  if (payToPlayMatch) risk_flags_structured.push({ severity: 'Major', flag: 'Pay-to-play indications', mitigation: 'Confirm editorial policy or negotiate earned placement' });
  if (strongAvoidCentral) risk_flags_structured.push({ severity: 'Critical', flag: `Avoid term prominent: ${avoidCounts[0].a}`, mitigation: 'Pick a different episode or angle; avoid brand conflict' });

  // Talking points
  const recommended_talking_points = [
    strongHits[0]?.term ? `Lead with ${strongHits[0].term} and enterprise risk` : 'Lead with concrete enterprise risk/use case',
    enterpriseVibe ? 'Offer a short demo tied to the episode theme' : 'Offer a pragmatic guide/checklist as CTA',
    strongAudienceEvidence ? 'Map benefits to CISO/CIO/OT ops outcomes' : 'Request ICP confirmation (role/industry) before pitching',
  ];

  // Confidence
  let confidence = 0.5 + Math.min(0.2, tokens.length / 6000) + (nonGenericQuotes.length ? 0.1 : 0) - (!mediaKitUrl ? 0.1 : 0);
  confidence = Math.max(0.25, Math.min(0.95, confidence));
  const confidence_label = confidence >= 0.75 ? 'High' : confidence >= 0.5 ? 'Med' : 'Low';
  const confidence_note = `${nonGenericQuotes.length} usable quotes; notes ${tokens.length} tokens; media kit ${mediaKitUrl ? 'present' : 'missing'}`;

  // Verdict policy (aligned)
  const hasCritical = why_not_fit_structured.some(w => w.severity === 'Critical') || risk_flags_structured.some(r => r.severity === 'Critical') || (cap_applied && (cap_type === 'avoid' || cap_type === 'pay_to_play'));
  const verdict: 'recommend' | 'consider' | 'not_recommended' = hasCritical ? 'not_recommended' : overall >= 7.5 ? 'recommend' : overall < 6.0 ? 'not_recommended' : 'consider';
  const verdict_reason = verdict === 'recommend'
    ? 'Strong thematic and audience alignment with low risk'
    : verdict === 'consider'
      ? 'Partial alignment; proceed if a condition is met'
      : 'Low alignment or critical blocker present';

  // What would change the verdict
  const what_would_change = [] as string[];
  if (!strongAudienceEvidence) what_would_change.push('If host confirms ICP (role/industry) relevance');
  if (cap_type === 'zero_overlap') what_would_change.push('If recent episodes show recurring relevant themes');

  // Legacy arrays
  const why_fit = why_fit_structured.map(w => `${w.claim} — "${w.evidence}" (${w.interpretation})`).slice(0, 5);
  const why_not_fit = why_not_fit_structured.map(w => `${w.claim} [${w.severity}] — "${w.evidence}" (${w.interpretation})`).slice(0, 4);
  const risk_flags = risk_flags_structured.map(r => `${r.flag} [${r.severity}]`);

  // Summary
  const summary_text = buildSummary({ overall: overall, verdict, why_fit_structured, why_not_fit_structured, risk_flags_structured, clientName: client?.name || client?.company || 'the client' });

  const rubric_breakdown = [
    { dimension: 'Topic relevance', weight: 0.41, raw_score: topicRelevance, notes: strongHits[0]?.term ? `Concept hits include: ${[...new Set(strongHits.slice(0,3).map(h=>h.term))].join(', ')}` : 'Limited explicit overlap; used near-matches' },
    { dimension: 'ICP alignment', weight: 0.29, raw_score: icpAlignment, notes: (audStrong >= 1 || audAdj >= 2) ? 'ICP cues detected' : 'ICP weak/implicit' },
    { dimension: 'CTA synergy', weight: 0.18, raw_score: ctaSynergy, notes: enterpriseVibe ? 'Enterprise CTA likely' : 'Generic CTA vibe' },
    { dimension: 'Brand suitability', weight: 0.12, raw_score: brandSuitability, notes: toneNegInNotes ? 'Tone risks present' : 'Tone neutral/ok' },
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
    applied_adjustments,
    audit_notes: [
      `strongHits=${strongHits.length}`,
      `nearHits=${nearHits.length}`,
      `distinctConcepts=${distinctConcepts}`,
      `audStrong=${audStrong}`,
      `audAdj=${audAdj}`,
    ],
    cap_reason: cap_reason,
    cap_type,
    audit: {
      weighted_mean,
      adjustments: { genericness: adj_genericness, multi_concept: adj_multi_concept, cadence: adj_cadence },
      cap_applied,
      cap_type,
      cap_evidence,
    },
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
  const verdictWord = args.verdict === 'recommend' ? 'Fit' : args.verdict === 'consider' ? 'Consider' : 'Not a fit';
  const audienceClaim = args.why_fit_structured.find(i => /audience|ICP/i.test(i.claim))?.claim
    || 'the target audience';
  const themes = args.why_fit_structured.slice(0, 2).map(i => i.claim).join('; ') || 'recurring themes relevant to the campaign';
  const align = 'The format and tone support goals around education and authority without feeling sales-forward.';
  const gap = args.why_not_fit_structured[0];
  const gapsText = gap ? `${gap.severity === 'Critical' ? 'critical' : 'minor'} gap: ${gap.claim.toLowerCase()}` : 'no material gaps noted';
  const risk = args.risk_flags_structured[0]?.flag || '';
  const risksText = risk ? `Risks/constraints: ${risk.toLowerCase()}.` : '';
  const next = args.verdict === 'recommend'
    ? 'Next step: pitch a specific topic angle tailored to the show.'
    : args.verdict === 'consider'
      ? 'Next step: proceed if ICP and topic are confirmed by the host.'
      : 'Next step: suggest an adjacent show type with stronger audience alignment.';

  return `Verdict: ${verdictWord} for ${args.clientName}. Audience: ${audienceClaim} and why that matters to the campaign. Content focus: ${themes} mapped to the client’s talking points. Why it aligns: ${align} Gaps to note: ${gapsText}. ${risksText} Next step: ${next}`;
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

      // Post-process AI result: enforce caps/floors, attach adjustments, ensure summary consistency
      const notesText = String(show_notes || "");
      const expanded = expandConcepts(client);
      const conceptHitsCount = findPositions(notesText, expanded.strong).length + findPositions(notesText, expanded.near).length;
      const conceptOverlap = conceptHitsCount > 0;
      const avoids: string[] = (client?.avoid || []) as string[];
      const avoidCounts = avoids.map(a => ({ a, c: count(notesText, [a]) })).sort((x,y)=>y.c - x.c);
      const strongAvoidCentral = avoidCounts[0]?.c >= 2;

      // Compute weighted mean from LLM rubric
      const rb: any[] = Array.isArray(data?.rubric_breakdown) ? data.rubric_breakdown : [];
      const topicRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('topic'))?.raw_score) || 0);
      const icpRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('icp'))?.raw_score) || 0);
      const ctaRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('cta'))?.raw_score) || 0);
      const brandRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('brand'))?.raw_score) || 0);
      const weighted_mean = topicRaw*0.41 + icpRaw*0.29 + ctaRaw*0.18 + brandRaw*0.12;

      let adjusted = Number(data?.overall_score) || 0;
      const applied_adjustments: { type: 'cap'|'floor'|'penalty'|'bonus'; label: string; amount?: number }[] = [];

      // Cap tracking (apply at most one)
      let cap_applied = false;
      let cap_type: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'none' = 'none';
      let cap_evidence = '';
      let cap_reason: string | undefined;
      const tryCap = (type: typeof cap_type, evidence: string) => {
        if (cap_applied) return;
        cap_applied = true; cap_type = type; cap_evidence = evidence || '';
        adjusted = Math.min(adjusted, 5.0);
        applied_adjustments.push({ type: 'cap', label: `${type.replace(/_/g,' ')}`, amount: 5.0 });
        cap_reason = `${type.replace(/_/g,' ')} — "${evidence || 'evidence required'}"`;
      };

      const payToPlayMatch = notesText.match(/(sponsored by|paid placement|advertorial|pay\s*to\s*play)/i);
      const linkBanMatch = notesText.match(/(no\s+links|do\s+not\s+include\s+links|don['’]t\s+include\s+urls|no\s+urls)/i);
      const enterpriseVibe = /(enterprise|b2b|ciso|cio|governance|compliance|risk|security)/i.test(notesText);
      const consumerCue = /(giveaway|coupon|subscribe and save|lifestyle|beauty|fashion|fitness|cooking|parenting|celebrity|gossip)/i.test(notesText);
      const b2cMismatch = consumerCue && !enterpriseVibe;

      if (strongAvoidCentral) {
        tryCap('avoid', avoidCounts[0].a);
      } else if (payToPlayMatch) {
        tryCap('pay_to_play', payToPlayMatch[0]);
      } else if (linkBanMatch) {
        tryCap('link_ban', linkBanMatch[0]);
      } else if (b2cMismatch) {
        tryCap('b2c_mismatch', 'consumer-only cues without enterprise signals');
      } else if (!conceptOverlap && topicRaw <= 5.0) {
        tryCap('zero_overlap', 'No relevant terms detected');
      }

      // Minor floor if strong evidence: keep existing heuristic (concept seeds + audience evidence)
      const aud: string[] = (client?.target_audiences || []) as string[];
      const audStrong = findPositions(notesText, aud.map(norm)).length;
      const nearHitsCount = findPositions(notesText, expanded.near).length;
      const eduAdjacency = /(k-?12|education|teacher|classroom|curriculum|students|district|school|edtech|stem)/i.test(notesText);
      if (!conceptOverlap) {
        if (audStrong >= 1 || nearHitsCount >= 2 || eduAdjacency) {
          adjusted = Math.min(adjusted, 6.5);
          applied_adjustments.push({ type: 'cap', label: 'Zero concept overlap (adjacency present)', amount: 6.5 });
        } else if (!cap_applied) {
          adjusted = Math.min(adjusted, 4.0);
          applied_adjustments.push({ type: 'cap', label: 'Zero concept overlap', amount: 4.0 });
        }
      }

      // Calibration invariants
      const criticalCap = cap_applied && (cap_type === 'avoid' || cap_type === 'pay_to_play' || cap_type === 'link_ban' || cap_type === 'b2c_mismatch' || cap_type === 'zero_overlap');
      if (!criticalCap && topicRaw >= 8 && icpRaw >= 7 && brandRaw >= 7) {
        adjusted = Math.max(adjusted, 7.0);
      }
      if (!criticalCap && adjusted < (weighted_mean - 2.0)) {
        adjusted = weighted_mean - 2.0;
      }
      adjusted = roundToHalf(clamp(adjusted, 0, 10));

      const ensureArray = (v: any) => Array.isArray(v) ? v : [];
      const why_fit_structured = ensureArray(data?.why_fit_structured);
      const why_not_fit_structured = ensureArray(data?.why_not_fit_structured);
      const risk_flags_structured = ensureArray(data?.risk_flags_structured);

      // Derive legacy arrays for UI compatibility
      const why_fit = why_fit_structured.map((w: any) => `${w.claim} — "${w.evidence}" (${w.interpretation})`).slice(0, 5);
      const why_not_fit = why_not_fit_structured.map((w: any) => `${w.claim} [${w.severity}] — "${w.evidence}" (${w.interpretation})`).slice(0, 4);
      const risk_flags = risk_flags_structured.map((r: any) => `${r.flag} [${r.severity}]`);

      // Verdict from adjusted
      const hasCritical = why_not_fit_structured.some((w: any) => w.severity === 'Critical') || risk_flags_structured.some((r: any) => r.severity === 'Critical') || criticalCap;
      const verdict: 'recommend' | 'consider' | 'not_recommended' = hasCritical ? 'not_recommended' : adjusted >= 7.5 ? 'recommend' : adjusted < 6.0 ? 'not_recommended' : 'consider';
      const confidence_label = data?.confidence_label || ((Number(data?.confidence) || 0.5) >= 0.75 ? 'High' : (Number(data?.confidence) || 0.5) >= 0.5 ? 'Med' : 'Low');
      const confidence_note = data?.confidence_note || `${(data?.citations || []).length} usable quotes`;

      const merged = {
        overall_score: adjusted,
        rubric_breakdown: rb,
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
        applied_adjustments,
        summary_text: '',
        cap_reason: cap_reason,
        cap_type,
        audit: {
          weighted_mean,
          adjustments: { genericness: 0, multi_concept: 0, cadence: 0 },
          cap_applied,
          cap_type,
          cap_evidence,
        },
      } as any;

      // Always build summary from the final verdict and score for consistency
      merged.summary_text = buildSummary({
        overall: merged.overall_score,
        verdict: merged.verdict!,
        why_fit_structured: merged.why_fit_structured || [],
        why_not_fit_structured: merged.why_not_fit_structured || [],
        risk_flags_structured: merged.risk_flags_structured || [],
        clientName: client?.name || client?.company || 'the client',
      });

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
