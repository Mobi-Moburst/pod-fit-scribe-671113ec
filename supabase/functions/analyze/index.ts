// ============= IMPORTS AND SETUP =============
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= UTILITY FUNCTIONS =============
const norm = (s: string | string[]): string => Array.isArray(s) ? s.join(' ').toLowerCase() : (s || '').toLowerCase();
const roundToHalf = (x: number): number => Math.round(x * 2) / 2;
const clamp = (x: number, min = 0, max = 10): number => Math.max(min, Math.min(max, x));

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

function keywords(text: string | string[], limit = 20): string[] {
  const tokens = Array.isArray(text) ? text : tokenize(text);
  const freq: Record<string, number> = {};
  for (const token of tokens) {
    if (token.length > 2) freq[token] = (freq[token] || 0) + 1;
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([word]) => word);
}

function count(text: string, terms: string[]): number {
  const normalizedText = norm(text);
  return terms.filter(term => normalizedText.includes(norm(term))).length;
}

function findPositions(text: string, terms: string[], limit = 10): { term: string; index: number }[] {
  const results: { term: string; index: number }[] = [];
  const normalizedText = norm(text);
  
  for (const term of terms) {
    const normalizedTerm = norm(term);
    let index = normalizedText.indexOf(normalizedTerm);
    if (index !== -1) {
      results.push({ term, index });
    }
  }
  
  return results.slice(0, limit);
}

function quoteAround(text: string, index: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).trim();
}

function isGenericSlogan(text: string): boolean {
  const generic = ['innovative', 'cutting-edge', 'game-changing', 'revolutionary', 'industry-leading'];
  return generic.some(g => norm(text).includes(g));
}

// ============= DATA ENRICHMENT =============
function expandConcepts(client: any): { strong: string[]; near: string[] } {
  const talkingPoints = Array.isArray(client?.talking_points) ? client.talking_points : [];
  const targetAudiences = Array.isArray(client?.target_audiences) ? client.target_audiences : [];
  
  const strong = [...talkingPoints];
  const near = [...targetAudiences];
  
  return { strong, near };
}

async function enrichClientData(mediaKitUrl: string): Promise<any> {
  if (!mediaKitUrl) return {};
  
  try {
    const response = await fetch(mediaKitUrl);
    if (!response.ok) return {};
    
    const text = await response.text();
    const title = extractTitle(text);
    const bio = text.slice(0, 500);
    const achievements = extractAchievements(text);
    const identityMarkers = extractIdentityMarkers(text);
    const genderInference = inferGender(text);
    
    return {
      title,
      bio,
      achievements,
      identityMarkers,
      genderInference
    };
  } catch {
    return {};
  }
}

function extractTitle(text: string): string {
  const titlePatterns = [
    /(?:ceo|founder|president|director|manager|lead|head|chief)/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) return match[0].toLowerCase();
  }
  
  return '';
}

function extractAchievements(text: string): string[] {
  const achievements: string[] = [];
  const normalizedText = norm(text);
  
  if (normalizedText.includes('founder')) achievements.push('founder');
  if (normalizedText.includes('ceo')) achievements.push('ceo');
  if (normalizedText.includes('author')) achievements.push('author');
  if (normalizedText.includes('veteran')) achievements.push('veteran');
  
  return achievements;
}

function extractIdentityMarkers(text: string): string[] {
  const markers: string[] = [];
  const normalizedText = norm(text);
  
  if (/(black|african.american)/i.test(normalizedText)) markers.push('black');
  if (/(latina?|hispanic)/i.test(normalizedText)) markers.push('latina');
  if (/(lgbtq|queer|gay|lesbian)/i.test(normalizedText)) markers.push('lgbtq+');
  if (/(christian|faith)/i.test(normalizedText)) markers.push('christian');
  
  return markers;
}

function inferGender(text: string): { value: string; confidence: 'high' | 'medium' | 'low' } {
  const normalizedText = norm(text);
  
  // High confidence patterns
  if (/(she\/her|her\/she)/i.test(normalizedText)) {
    return { value: 'female', confidence: 'high' };
  }
  if (/(he\/him|him\/he)/i.test(normalizedText)) {
    return { value: 'male', confidence: 'high' };
  }
  
  // Medium confidence from common names (simplified)
  const femaleNames = ['sarah', 'jessica', 'jennifer', 'lisa', 'michelle', 'amanda', 'stephanie'];
  const maleNames = ['john', 'michael', 'david', 'james', 'robert', 'william', 'richard'];
  
  for (const name of femaleNames) {
    if (normalizedText.includes(name)) {
      return { value: 'female', confidence: 'medium' };
    }
  }
  
  for (const name of maleNames) {
    if (normalizedText.includes(name)) {
      return { value: 'male', confidence: 'medium' };
    }
  }
  
  return { value: 'unknown', confidence: 'low' };
}

function detectGuestRequirements(notes: string): { class: string; type: string; evidence: string } {
  const normalizedNotes = norm(notes);
  
  // Gender requirements
  if (/(women|female).*(only|exclusively|specifically)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'gender', evidence: 'women only' };
  }
  
  if (/(men|male).*(only|exclusively|specifically)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'gender', evidence: 'men only' };
  }
  
  // Identity/community requirements
  if (/(black|african.american).*(only|exclusively|founders|entrepreneurs)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'identity', evidence: 'Black founders only' };
  }
  
  if (/(latina?|hispanic).*(only|exclusively|founders|entrepreneurs)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'identity', evidence: 'Latina entrepreneurs only' };
  }
  
  if (/(veteran).*(only|exclusively|founded)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'identity', evidence: 'veteran-founded only' };
  }
  
  // Role requirements
  if (/(founder).*(only|exclusively)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'role', evidence: 'founders only' };
  }
  
  if (/(ceo).*(only|exclusively)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'role', evidence: 'CEOs only' };
  }
  
  // Professional requirements
  if (/(author|published).*(only|exclusively)/i.test(normalizedNotes)) {
    return { class: 'exclusive', type: 'professional', evidence: 'published authors only' };
  }
  
  // Preferential (not exclusive)
  if (/(women|female|black|latina?|hispanic|founder|ceo|veteran)/i.test(normalizedNotes)) {
    return { class: 'preferential', type: 'general', evidence: 'community preference detected' };
  }
  
  return { class: 'none', type: 'none', evidence: '' };
}

// ---------------- Guest Eligibility Scoring ----------------
function scoreGuestEligibility(clientData: any, guestRequirements: any) {
  const requirements = guestRequirements;
  
  if (requirements.class === 'none') {
    return {
      score: 7.0, // Neutral - no requirements
      reasoning: "No specific guest requirements detected",
      confidence: 'high' as const,
      eligible: true,
    };
  }
  
  // Extract client info
  const clientTitle = clientData?.title?.toLowerCase() || '';
  const clientAchievements = clientData?.achievements || [];
  const clientIdentity = clientData?.identityMarkers || [];
  const clientGender = clientData?.genderInference?.value || 'unknown';
  
  let eligible = false;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let reasoning = '';
  
  // Check eligibility based on requirement type
  switch (requirements.type) {
    case 'gender':
      if (clientGender !== 'unknown') {
        confidence = clientData.genderInference.confidence;
        if (requirements.evidence.includes('women') || requirements.evidence.includes('female')) {
          eligible = clientGender === 'female';
          reasoning = eligible ? 'Client identified as female' : 'Client not identified as female';
        } else if (requirements.evidence.includes('men') || requirements.evidence.includes('male')) {
          eligible = clientGender === 'male';
          reasoning = eligible ? 'Client identified as male' : 'Client not identified as male';
        }
      } else {
        reasoning = 'Client gender could not be determined';
      }
      break;
      
    case 'role':
      if (requirements.evidence.includes('founder')) {
        eligible = clientAchievements.includes('founder') || clientTitle.includes('founder');
        reasoning = eligible ? 'Client identified as founder' : 'Client not identified as founder';
        confidence = clientTitle ? 'high' : 'medium';
      } else if (requirements.evidence.includes('ceo')) {
        eligible = clientAchievements.includes('ceo') || clientTitle.includes('ceo');
        reasoning = eligible ? 'Client identified as CEO' : 'Client not identified as CEO';
        confidence = clientTitle ? 'high' : 'medium';
      }
      break;
      
    case 'professional':
      if (requirements.evidence.includes('author')) {
        eligible = clientAchievements.includes('author');
        reasoning = eligible ? 'Client identified as published author' : 'Client not identified as published author';
        confidence = 'medium';
      }
      break;
      
    case 'identity':
      if (requirements.evidence.includes('veteran')) {
        eligible = clientAchievements.includes('veteran');
        reasoning = eligible ? 'Client identified as veteran' : 'Client not identified as veteran';
        confidence = 'medium';
      } else if (requirements.evidence.includes('lgbtq')) {
        eligible = clientIdentity.includes('lgbtq+');
        reasoning = eligible ? 'Client identified as LGBTQ+' : 'Client not identified as LGBTQ+';
        confidence = 'low'; // Identity is harder to determine from media kits
      } else if (requirements.evidence.includes('black')) {
        eligible = clientIdentity.includes('black');
        reasoning = eligible ? 'Client identified as Black' : 'Client not identified as Black';
        confidence = 'low';
      } else if (requirements.evidence.includes('christian')) {
        eligible = clientIdentity.includes('christian');
        reasoning = eligible ? 'Client has Christian background' : 'Client Christian background unclear';
        confidence = 'low';
      }
      break;
  }
  
  // Calculate score based on requirement class and eligibility
  let score = 7.0; // Default neutral for display (not used in weighted calculation)
  
  if (requirements.class === 'exclusive') {
    if (eligible && confidence === 'high') {
      score = 10.0; // Perfect match for exclusive requirement
    } else if (eligible && confidence === 'medium') {
      score = 8.5; // Good match but some uncertainty
    } else if (!eligible && confidence === 'high') {
      score = 0.5; // Clear mismatch for exclusive requirement
    } else {
      score = 3.0; // Unknown eligibility for exclusive requirement
      reasoning = `Eligibility unclear: ${reasoning}`;
    }
  } else if (requirements.class === 'preferential') {
    if (eligible && confidence === 'high') {
      score = 9.0; // Strong match for preference
    } else if (eligible && confidence === 'medium') {
      score = 8.0; // Good match for preference
    } else if (!eligible && confidence === 'high') {
      score = 4.0; // Misaligned with preference but not exclusive
    } else {
      score = 6.0; // Unknown but less critical for preferences
    }
  } else if (requirements.class === 'thematic') {
    score = 7.0; // Neutral - thematic doesn't require specific guests
    reasoning = 'Thematic focus but no specific guest requirements';
  }
  
  return {
    score: roundToHalf(clamp(score, 0, 10)),
    reasoning,
    confidence,
    eligible: eligible || requirements.class !== 'exclusive',
  };
}

// ---------------- Eligibility Gate Processing ----------------
function processEligibilityGate(guestRequirements: any, eligibilityResult: any, client: any, mode: string) {
  const { class: reqClass, evidence, type } = guestRequirements;
  
  // Check for opt-in in client notes
  const clientNotes = (client?.notes || '').toLowerCase();
  const hasOptIn = checkOptInInNotes(clientNotes, type, evidence);
  
  // Determine effective exclusivity 
  let effectiveClass = reqClass;
  if (reqClass === 'exclusive') {
    // Check if both community language AND guest pattern alignment
    const hasStrongGuestPattern = checkGuestPatternAlignment(evidence);
    if (!hasStrongGuestPattern) {
      effectiveClass = 'preferential'; // Downgrade if not truly exclusive
    }
  }
  
  // Gate logic
  if (effectiveClass === 'none' || effectiveClass === 'preferential') {
    return {
      class: effectiveClass,
      evidence: evidence || 'No guest requirements detected',
      action: 'proceeded',
      needs_confirmation: false
    };
  }
  
  // Exclusive/effective exclusive logic
  if (hasOptIn) {
    return {
      class: effectiveClass,
      evidence: `${evidence} (opt-in found in notes)`,
      action: 'proceeded',
      needs_confirmation: false
    };
  }
  
  // Check eligibility confidence
  if (!eligibilityResult.eligible && eligibilityResult.confidence === 'high') {
    return {
      class: effectiveClass,
      evidence: `${evidence} - ${eligibilityResult.reasoning}`,
      action: 'blocked',
      cap_to: 3.0,
      needs_confirmation: mode === 'ACTIVE'
    };
  }
  
  // Low confidence or unknown eligibility
  return {
    class: effectiveClass,
    evidence: `${evidence} - eligibility unclear`,
    action: 'conditional', 
    cap_to: 6.0,
    needs_confirmation: mode === 'ACTIVE'
  };
}

function checkOptInInNotes(notes: string, type: string, evidence: string): boolean {
  const patterns = [
    /targeting:\s*(black|latina?|hispanic|asian|lgbtq|women|female|veteran|christian)/i,
    /eligible for:\s*(black|latina?|hispanic|asian|lgbtq|women|female|veteran|christian)/i,
    /community focus:\s*(black|latina?|hispanic|asian|lgbtq|women|female|veteran|christian)/i,
    /(black|latina?|hispanic|asian|lgbtq|women|female|veteran|christian)[\s-]*(owned|led|founded|focused|background)/i
  ];
  
  return patterns.some(pattern => pattern.test(notes));
}

function checkGuestPatternAlignment(evidence: string): boolean {
  // Simplified check - in practice would analyze recent guest patterns
  // For now, assume strong pattern if explicit exclusive language
  const exclusivePatterns = [
    /only/i,
    /exclusively/i,
    /specifically for/i,
    /limited to/i
  ];
  
  return exclusivePatterns.some(pattern => pattern.test(evidence));
}

// ---------------- Goal-Centric Scoring ----------------
function scoreGoalCentric(client: any, tokens: string[], guestRequirements: any, enrichedData: any) {
  const clientData = enrichedData;
  const clientName = client?.name || client?.company || 'the client';
  const clientBio = clientData?.bio || '';
  const mediaKitUrl = client?.media_kit_url || '';
  const notes = tokens.join(' ').toLowerCase();
  
  // Feature flag for eligibility gate
  const eligibility_gate_mode = 'SHADOW'; // OFF | SHADOW | ACTIVE
  
  // Keywords
  const targetKeywords = expandConcepts(client?.talking_points || []);
  const avoidKeywords = expandConcepts(client?.avoid || []);
  
  const targetCounts = keywords(targetKeywords.strong.join(' ')).sort((a, b) => b.length - a.length);
  const avoidCounts = keywords(avoidKeywords.strong.join(' ')).sort((a, b) => b.length - a.length);
  
  // Evidence and quotes
  const strongHits = findPositions(notes, targetKeywords.strong);
  const nearHits = findPositions(notes, targetKeywords.near);
  const positions = [...strongHits, ...nearHits];
  const rawQuotes = positions.map(p => quoteAround(notes, p.index));
  const nonGenericQuotes = rawQuotes.filter(q => q && !isGenericSlogan(q)).slice(0, 8);
  const citations = nonGenericQuotes.length ? nonGenericQuotes.slice(0, 6) : keywords(notes).slice(0, 6);
  
  // Audience analysis
  const audiences = client?.target_audiences || [];
  const audStrong = findPositions(notes, audiences).length;
  const strongAudienceEvidence = audStrong >= 1;
  
  // CTA and enterprise detection
  const ctaTerms = ["book", "demo", "consult", "download", "guide", "report", "contact", "learn more", "talk to", "sales", "trial", "start"];
  const ctaOverlap = count(notes, ctaTerms);
  const enterpriseVibe = /(enterprise|b2b|ciso|cio|governance|compliance|risk|security)/i.test(notes) ? 1 : 0;
  
  // Brand and tone analysis
  const notesPref = client?.notes || '';
  const toneNegInNotes = /(explicit|nsfw|politics|gambling|hype|clickbait)/i.test(notes) ? 1 : 0;
  const payToPlayMatch = notes.match(/(sponsored by|paid placement|advertorial|pay\s*to\s*play)/i);
  const strongAvoidCentral = (avoidCounts[0]?.length || 0) >= 2;
  
  // Scores (each 1-10) - 4 dimensions only
  const topicRelevance = Math.min(10, 1 + 6 * Math.tanh(targetCounts.slice(0, 3).reduce((s, t) => s + t.length, 0) / 8));
  const icpAlignment = Math.min(10, 3 + 4 * Math.tanh(strongAudienceEvidence ? 2 : 0.5));
  const ctaSynergy = Math.min(10, 3 + 3 * (enterpriseVibe ? 1.5 : 1) + ctaOverlap * 2);
  const brandSuitability = Math.min(10, 7 - (toneNegInNotes ? 2 : 0) - (strongAvoidCentral ? 3 : 0));
  
  // Guest eligibility for display only (not scored)
  const eligibilityResult = scoreGuestEligibility(clientData, guestRequirements);
  
  // Weighted average (4 dimensions - eligibility excluded)
  const weights = { topic: 0.35, icp: 0.30, eligibility: 0.00, cta: 0.20, brand: 0.15 } as const;
  const weighted_mean = topicRelevance * weights.topic + icpAlignment * weights.icp + ctaSynergy * weights.cta + brandSuitability * weights.brand;
  
  // Adjustments
  const applied_adjustments: { type: 'cap' | 'floor' | 'penalty' | 'bonus'; label: string; amount?: number }[] = [];
  let adj_genericness = 0;
  const nonGenericCount = nonGenericQuotes.length;
  if (nonGenericCount <= 0) { adj_genericness = -1.5; }
  else if (nonGenericCount === 1) { adj_genericness = -1.0; }
  else if (nonGenericCount === 2) { adj_genericness = -0.5; }
  if (adj_genericness) applied_adjustments.push({ type: 'penalty', label: 'Genericness', amount: adj_genericness });
  
  let adj_multi_concept = 0;
  const distinctConcepts = new Set([...strongHits.map(h => h.term), ...nearHits.map(h => h.term)]).size;
  if (distinctConcepts >= 5) adj_multi_concept = +0.5;
  else if (distinctConcepts >= 3) adj_multi_concept = +0.3;
  if (adj_multi_concept) applied_adjustments.push({ type: 'bonus', label: 'Multi-concept', amount: adj_multi_concept });
  
  const adj_cadence = 0; // Removed per new policy
  
  // Baseline overall (before eligibility gate)
  let baseline_overall = weighted_mean + adj_genericness + adj_multi_concept + adj_cadence;
  baseline_overall = Math.max(1, Math.min(10, baseline_overall));
  
  // Traditional caps (override baseline)
  let cap_applied = false;
  let cap_type: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'eligibility' | 'none' = 'none';
  let cap_evidence = '';
  let overall = baseline_overall;
  
  if (targetCounts.length === 0 || targetCounts[0]?.length === 0) {
    overall = Math.min(3.0, overall);
    cap_applied = true;
    cap_type = 'zero_overlap';
    cap_evidence = 'No target keyword matches found';
  } else if (strongAvoidCentral) {
    overall = Math.min(2.0, overall);
    cap_applied = true;
    cap_type = 'avoid';
    cap_evidence = `Strong avoid term: ${avoidCounts[0]}`;
  } else if (payToPlayMatch) {
    overall = Math.min(4.0, overall);
    cap_applied = true;
    cap_type = 'pay_to_play';
    cap_evidence = 'Pay-to-play language detected';
  }
  
  // Eligibility gate processing
  const eligibilityGate = processEligibilityGate(guestRequirements, eligibilityResult, client, eligibility_gate_mode);
  
  // Apply eligibility cap if needed
  if (eligibilityGate.cap_to !== undefined) {
    overall = Math.min(eligibilityGate.cap_to, overall);
    if (!cap_applied) {
      cap_applied = true;
      cap_type = 'eligibility';
      cap_evidence = eligibilityGate.evidence;
    }
  }
  
  const cap_reason = cap_applied ? `Capped due to ${cap_type.replace('_', ' ')}: ${cap_evidence}` : undefined;
  
  // Why it fits
  const why_fit_structured = [] as { claim: string; evidence: string; interpretation: string }[];
  if (strongHits.length) why_fit_structured.push({
    claim: "Strong topic overlap",
    evidence: nonGenericQuotes[0] || strongHits[0]?.term || "",
    interpretation: "Maps directly to priority themes and enterprise use cases",
  });
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
  
  // Why it doesn't fit
  const why_not_fit_structured = [] as { severity: 'Critical' | 'Major' | 'Minor'; claim: string; evidence: string; interpretation: string }[];
  if (!strongAudienceEvidence) {
    why_not_fit_structured.push({ severity: 'Minor', claim: 'Audience specificity is weak', evidence: 'Lacks clear role/industry cues', interpretation: 'Proceed only if host confirms ICP details' });
  }
  
  // Add eligibility-specific feedback only if gate blocked
  if (eligibilityGate.action === 'blocked') {
    why_not_fit_structured.push({ 
      severity: 'Critical', 
      claim: `Guest eligibility requirements not met`, 
      evidence: eligibilityGate.evidence, 
      interpretation: 'Client eligibility needs confirmation for this community-exclusive show' 
    });
  }
  
  // Risk flags
  const risk_flags_structured: { severity: 'Critical' | 'Major' | 'Minor'; flag: string; mitigation: string }[] = [];
  if (payToPlayMatch) risk_flags_structured.push({ severity: 'Major', flag: 'Pay-to-play indications', mitigation: 'Confirm editorial policy or negotiate earned placement' });
  if (strongAvoidCentral) risk_flags_structured.push({ severity: 'Critical', flag: `Avoid term prominent: ${avoidCounts[0]}`, mitigation: 'Pick a different episode or angle; avoid brand conflict' });
  
  // Add eligibility risks if conditional
  if (eligibilityGate.action === 'conditional') {
    risk_flags_structured.push({ 
      severity: 'Major', 
      flag: 'Community eligibility requires confirmation', 
      mitigation: 'Verify client meets guest requirements before pitching' 
    });
  }
  
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
    { dimension: "Topic relevance", weight: weights.topic, raw_score: topicRelevance, notes: citations.slice(0, 3).join("; ") || "No specific matches" },
    { dimension: "ICP alignment", weight: weights.icp, raw_score: icpAlignment, notes: audStrong ? `${audStrong} audience hits` : "Weak audience signals" },
    { dimension: "Guest eligibility", weight: weights.eligibility, raw_score: eligibilityResult.score, notes: `${eligibilityGate.class} - ${eligibilityGate.evidence}` },
    { dimension: "CTA synergy", weight: weights.cta, raw_score: ctaSynergy, notes: enterpriseVibe ? "Enterprise tone supports B2B CTA" : `${ctaOverlap} CTA terms` },
    { dimension: "Brand suitability", weight: weights.brand, raw_score: brandSuitability, notes: toneNegInNotes ? "Tone concerns detected" : "Appropriate brand fit" },
  ] as const;
  
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
    cap_reason,
    cap_type,
    eligibility: eligibilityGate,
    audit: {
      baseline_overall,
      final_overall: overall,
      weighted_mean,
      adjustments: { genericness: adj_genericness, multi_concept: adj_multi_concept, cadence: adj_cadence },
      cap_applied,
      cap_type,
      cap_evidence,
    },
    // Modal trigger
    needs_confirmation: eligibilityGate.needs_confirmation || false,
  };
}

function buildSummary(params: any): string {
  const { overall, verdict, why_fit_structured, why_not_fit_structured, risk_flags_structured, clientName } = params;
  
  const verdictText = verdict === 'recommend' ? 'Recommended' : verdict === 'consider' ? 'Consider' : 'Not recommended';
  const scoreText = `${overall.toFixed(1)}/10`;
  
  let summary = `${verdictText} (${scoreText}) for ${clientName}. `;
  
  if (why_fit_structured.length > 0) {
    summary += `Strong points: ${why_fit_structured[0].claim}. `;
  }
  
  if (why_not_fit_structured.length > 0) {
    summary += `Concerns: ${why_not_fit_structured[0].claim}. `;
  }
  
  if (risk_flags_structured.length > 0) {
    summary += `Key risk: ${risk_flags_structured[0].flag}.`;
  }
  
  return summary;
}

// ============= ENTRY POINT =============
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ANALYZE FUNCTION START ===');
    
    let body;
    try {
      body = await req.json();
      console.log('Request body parsed successfully');
    } catch (e) {
      console.error('Failed to parse request body:', e.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { client, show_notes } = body;
    console.log('Client:', client ? 'present' : 'missing');
    console.log('Show notes length:', show_notes ? show_notes.length : 0);
    
    if (!client || !show_notes) {
      console.error('Missing required fields - client:', !!client, 'show_notes:', !!show_notes);
      return new Response(
        JSON.stringify({ success: false, error: 'Missing client or show_notes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('=== STEP 1: Tokenizing show notes ===');
    let tokens;
    try {
      tokens = tokenize(show_notes);
      console.log('Tokenization complete - token count:', tokens.length);
    } catch (e) {
      console.error('Tokenization failed:', e.message);
      throw new Error(`Tokenization failed: ${e.message}`);
    }
    
    console.log('=== STEP 2: Enriching client data ===');
    let enrichedData;
    try {
      enrichedData = await enrichClientData(client.media_kit_url || '');
      console.log('Client data enrichment complete');
    } catch (e) {
      console.error('Client enrichment failed:', e.message);
      // Continue with empty enriched data
      enrichedData = {};
    }
    
    console.log('=== STEP 3: Detecting guest requirements ===');
    let guestRequirements;
    try {
      guestRequirements = detectGuestRequirements(show_notes);
      console.log('Guest requirements detected:', guestRequirements.class, guestRequirements.type);
    } catch (e) {
      console.error('Guest requirements detection failed:', e.message);
      throw new Error(`Guest requirements detection failed: ${e.message}`);
    }
    
    console.log('=== STEP 4: Goal-centric scoring ===');
    let result;
    try {
      result = scoreGoalCentric(client, tokens, guestRequirements, enrichedData);
      console.log('Scoring complete - overall score:', result.overall_score);
    } catch (e) {
      console.error('Scoring failed:', e.message, e.stack);
      throw new Error(`Scoring failed: ${e.message}`);
    }
    
    console.log('=== ANALYSIS COMPLETE ===');
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('=== CRITICAL ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Analysis failed', 
        message: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});