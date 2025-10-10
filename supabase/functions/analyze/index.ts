import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-org-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// ---------------- Enterprise Cue Detection ----------------
function countEnterpriseCues(text: string): number {
  const lower = norm(text);
  const enterpriseCues = {
    titles: ['ciso', 'cio', 'cto', 'head of security', 'chief security', 'chief information', 'vp security', 'director security', 'head of it', 'it director'],
    frameworks: ['soc 2', 'soc2', 'iso 27001', 'iso27001', 'nist', 'fedramp', 'hipaa', 'sox', 'gdpr', 'ccpa', 'pci dss', 'cmmc'],
    phrases: ['b2b', 'governance', 'compliance', 'risk management', 'rollout', 'stakeholders', 'enterprise', 'regulated', 'audit', 'board level', 'enterprise-grade', 'saas platform'],
    vendors: ['okta', 'crowdstrike', 'splunk', 'palo alto', 'microsoft', 'salesforce', 'workday', 'servicenow', 'azure', 'aws', 'google cloud', 'snowflake']
  };
  
  let count = 0;
  for (const cueList of Object.values(enterpriseCues)) {
    for (const cue of cueList) {
      const re = new RegExp(`\\b${esc(cue)}\\b`, 'g');
      const matches = lower.match(re);
      if (matches) count += matches.length;
    }
  }
  return count;
}

function detectConsumerCues(text: string): string[] {
  const lower = norm(text);
  const cues = [
    'giveaway', 'coupon', 'subscribe and save', 'lifestyle', 'beauty', 'fashion', 
    'fitness', 'cooking', 'parenting', 'celebrity', 'gossip', 'personal finance', 
    'budgeting', 'diy', 'home improvement', 'recipe', 'wellness', 'self-care',
    'shopping', 'deals', 'discount', 'influencer', 'vlog', 'makeup', 'skincare'
  ];
  return cues.filter(cue => new RegExp(`\\b${esc(cue)}\\b`, 'g').test(lower));
}

// ---------------- Influence & Authority Signals ----------------
function extractInfluenceSignals(text: string) {
  const lower = norm(text);
  
  // Awards/wins detection
  let awards = 0;
  const awardPatterns = [
    /best\s+([\w\s]+\s+)?podcast/i,
    /award[\s-]?winning/i,
    /shortlisted?\s+for/i,
    /nominated\s+for/i,
    /top\s+\d+\s+podcast/i,
  ];
  const awardMatches = awardPatterns.reduce((sum, p) => sum + (text.match(p) || []).length, 0);
  if (awardMatches >= 3) awards = 2; // Repeated wins
  else if (awardMatches >= 1) awards = 1; // Mentions
  
  // Download scale detection
  let downloads_tier = 0;
  const downloadPatterns = [
    { pattern: /(\d+)\s*(?:million|m)\+?\s+download/i, threshold: 10, tier: 3 },
    { pattern: /(\d+)\s*(?:million|m)\+?\s+download/i, threshold: 5, tier: 2 },
    { pattern: /(\d+)\s*(?:million|m)\+?\s+download/i, threshold: 1, tier: 1 },
  ];
  for (const { pattern, threshold, tier } of downloadPatterns) {
    const match = text.match(pattern);
    if (match && parseInt(match[1]) >= threshold) {
      downloads_tier = Math.max(downloads_tier, tier);
    }
  }
  
  // Top guest detection (recognized security/tech leaders)
  const topGuestNames = [
    'mikko hyppönen', 'hypponen', 'garry kasparov', 'kasparov',
    'jack rhysider', 'rhysider', 'bruce schneier', 'schneier',
    'katie moussouris', 'moussouris', 'troy hunt', 'brian krebs', 'krebs',
    'adam shostack', 'shostack', 'rik ferguson', 'ferguson',
    'nicole perlroth', 'perlroth', 'kim zetter', 'zetter',
    'tarah wheeler', 'wheeler', 'parisa tabriz', 'tabriz',
  ];
  const top_guests = topGuestNames.filter(name => lower.includes(name)).length;
  
  // Longevity & cadence detection
  const yearsMatch = text.match(/(\d+)\+?\s+years?/i);
  const years = yearsMatch ? parseInt(yearsMatch[1]) : 0;
  const cadencePatterns = /\b(weekly|bi-?weekly|consistent|regular|every\s+(week|monday|tuesday|wednesday|thursday|friday))/i;
  const hasCadence = cadencePatterns.test(lower);
  const longevity = years >= 3 && hasCadence;
  
  // Chart rankings / press mentions
  const chartPatterns = [
    /top\s+\d+/i,
    /chart[\s-]?topping/i,
    /featured\s+by\s+(apple|spotify|google)/i,
    /\b(techcrunch|wired|forbes|wsj|new york times|nyt)\b/i,
  ];
  const charts = chartPatterns.some(p => p.test(text));
  
  return {
    awards,
    downloads_tier,
    top_guests: Math.min(3, top_guests),
    longevity,
    charts,
  };
}

function calculateInfluenceMultiplier(signals: ReturnType<typeof extractInfluenceSignals>): number {
  let multiplier = 1.0;
  
  // Awards bonus
  if (signals.awards === 2) multiplier += 0.08; // Repeated wins
  else if (signals.awards === 1) multiplier += 0.05; // Mentions
  
  // Download scale bonus
  if (signals.downloads_tier === 3) multiplier += 0.10; // 10M+
  else if (signals.downloads_tier === 2) multiplier += 0.07; // 5M+
  else if (signals.downloads_tier === 1) multiplier += 0.04; // 1M+
  
  // Guest caliber bonus
  if (signals.top_guests >= 3) multiplier += 0.06;
  else if (signals.top_guests === 2) multiplier += 0.04;
  else if (signals.top_guests === 1) multiplier += 0.03;
  
  // Longevity bonus
  if (signals.longevity) multiplier += 0.04;
  
  // Chart/press bonus
  if (signals.charts) multiplier += 0.04;
  
  // Cap at 1.15, floor at 0.90
  return Math.max(0.90, Math.min(1.15, multiplier));
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

// ---------------- Client Data Enrichment ----------------
async function enrichClientData(mediaKitUrl: string) {
  if (!mediaKitUrl) return null;
  
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({ url: mediaKitUrl }),
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.success) return null;
    
    const content = data.show_notes || "";
    
    return {
      title: extractTitle(content),
      bio: content,
      pronouns: extractPronouns(content),
      genderInference: inferGender(content),
      achievements: extractAchievements(content),
      identityMarkers: extractIdentityMarkers(content),
    };
  } catch (error) {
    console.log("Failed to enrich client data:", error);
    return null;
  }
}

function extractTitle(content: string): string | null {
  const titlePatterns = [
    /(?:ceo|chief executive officer|founder|co-founder|president|cto|cfo|ciso|chief|vp|vice president|director|manager|executive|head of|author|dr\.|doctor|professor|prof\.|consultant)/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = content.match(pattern);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

function extractPronouns(content: string): string | null {
  const pronounMatches = content.match(/\b(she\/her|he\/him|they\/them|he\/they|she\/they)\b/i);
  return pronounMatches ? pronounMatches[1].toLowerCase() : null;
}

function inferGender(content: string): { value: 'male' | 'female' | 'non_binary' | 'unknown'; confidence: 'high' | 'medium' | 'low'; source: string } {
  // Check explicit pronouns first
  const pronouns = extractPronouns(content);
  if (pronouns) {
    if (pronouns.includes('she')) return { value: 'female', confidence: 'high', source: 'explicit_pronouns' };
    if (pronouns.includes('he')) return { value: 'male', confidence: 'high', source: 'explicit_pronouns' };
    if (pronouns.includes('they')) return { value: 'non_binary', confidence: 'high', source: 'explicit_pronouns' };
  }
  
  // Check bio context
  const femaleContexts = /\b(woman|female|lady|girl|mother|mom|wife|daughter|sister|ms\.|mrs\.|miss)\b/i;
  const maleContexts = /\b(man|male|gentleman|boy|father|dad|husband|son|brother|mr\.)\b/i;
  
  const femaleMatches = (content.match(femaleContexts) || []).length;
  const maleMatches = (content.match(maleContexts) || []).length;
  
  if (femaleMatches > maleMatches && femaleMatches >= 2) {
    return { value: 'female', confidence: 'medium', source: 'bio_context' };
  }
  if (maleMatches > femaleMatches && maleMatches >= 2) {
    return { value: 'male', confidence: 'medium', source: 'bio_context' };
  }
  
  return { value: 'unknown', confidence: 'low', source: 'insufficient_data' };
}

function extractAchievements(content: string): string[] {
  const achievements = [];
  
  if (/\b(author|published|book|bestselling|wrote|writing)\b/i.test(content)) {
    achievements.push('author');
  }
  if (/\b(founder|founded|co-founder|startup|entrepreneur)\b/i.test(content)) {
    achievements.push('founder');
  }
  if (/\b(veteran|military|served|army|navy|air force|marines|service member)\b/i.test(content)) {
    achievements.push('veteran');
  }
  if (/\b(ceo|chief executive|president)\b/i.test(content)) {
    achievements.push('ceo');
  }
  
  return achievements;
}

function extractIdentityMarkers(content: string): string[] {
  const markers = [];
  
  if (/\b(lgbtq|lgbt|queer|gay|lesbian|bisexual|transgender|non-binary)\b/i.test(content)) {
    markers.push('lgbtq+');
  }
  if (/\b(black|african american|african-american)\b/i.test(content)) {
    markers.push('black');
  }
  if (/\b(hispanic|latino|latina|latinx)\b/i.test(content)) {
    markers.push('hispanic');
  }
  if (/\b(asian|asian american|asian-american)\b/i.test(content)) {
    markers.push('asian');
  }
  if (/\b(christian|faith|ministry|church)\b/i.test(content)) {
    markers.push('christian');
  }
  
  return markers;
}

// ---------------- Guest Requirements Detection ----------------
function detectGuestRequirements(show_notes: string) {
  const notes = norm(show_notes);
  
  const requirements = {
    class: 'none' as 'exclusive' | 'preferential' | 'thematic' | 'none',
    type: 'none' as 'gender' | 'role' | 'identity' | 'professional' | 'mixed' | 'none',
    evidence: '',
    patterns: [] as string[],
  };
  
  // Combined patterns (highest priority - check FIRST)
  const combinedPatterns = [
    { pattern: /\b(black women|african american women)\s+(entrepreneurs?|founders?|leaders?|ceos?)\b/i, type: 'mixed', evidence: 'black women entrepreneurs', requiresBoth: ['gender:female', 'identity:black'] },
    { pattern: /\b(latina|hispanic women)\s+(entrepreneurs?|founders?|leaders?)\b/i, type: 'mixed', evidence: 'latina entrepreneurs', requiresBoth: ['gender:female', 'identity:hispanic'] },
    { pattern: /\b(women veterans?|female veterans?)\b/i, type: 'mixed', evidence: 'women veterans', requiresBoth: ['gender:female', 'identity:veteran'] },
    { pattern: /\b(lgbtq\+? women|queer women)\s+(entrepreneurs?|founders?)\b/i, type: 'mixed', evidence: 'lgbtq+ women entrepreneurs', requiresBoth: ['gender:female', 'identity:lgbtq+'] },
  ];

  // Exclusive patterns (hard requirements)
  const exclusivePatterns = [
    { pattern: /\b(women only|female only|exclusively women|exclusively female)\b/i, type: 'gender', evidence: 'women only' },
    { pattern: /\b(men only|male only|exclusively men|exclusively male)\b/i, type: 'gender', evidence: 'men only' },
    { pattern: /\b(founders only|exclusively founders)\b/i, type: 'role', evidence: 'founders only' },
    { pattern: /\b(ceos only|exclusively ceos|chief executives only)\b/i, type: 'role', evidence: 'ceos only' },
    { pattern: /\b(authors only|exclusively authors|published authors only)\b/i, type: 'professional', evidence: 'authors only' },
    { pattern: /\b(veterans only|exclusively veterans|military veterans only)\b/i, type: 'identity', evidence: 'veterans only' },
    { pattern: /\b(lgbtq\+ only|exclusively lgbtq|queer only)\b/i, type: 'identity', evidence: 'lgbtq+ only' },
  ];
  
  // Preferential patterns (strong preference)
  const preferentialPatterns = [
    { pattern: /\b(women entrepreneurs|female founders|women in tech|women leaders)\b/i, type: 'gender', evidence: 'women focus' },
    { pattern: /\b(veteran entrepreneurs|military founders|veteran-owned)\b/i, type: 'identity', evidence: 'veteran focus' },
    { pattern: /\b(black founders|african american entrepreneurs)\b/i, type: 'identity', evidence: 'black founders focus' },
    { pattern: /\b(hispanic entrepreneurs|latino founders|latina leaders)\b/i, type: 'identity', evidence: 'hispanic focus' },
    { pattern: /\b(lgbtq entrepreneurs|queer founders|lgbtq\+ leaders)\b/i, type: 'identity', evidence: 'lgbtq+ focus' },
    { pattern: /\b(christian entrepreneurs|faith-based business|ministry leaders|believers only|faith-based)\b/i, type: 'identity', evidence: 'christian focus' },
    { pattern: /\b(conservative|right-?wing|republican|libertarian)\b/i, type: 'ideology', evidence: 'conservative leaning' },
    { pattern: /\b(progressive|liberal|left-?wing|democrat)\b/i, type: 'ideology', evidence: 'progressive leaning' },
    { pattern: /\b(primarily women|mostly female|focus on women)\b/i, type: 'gender', evidence: 'women preference' },
    { pattern: /\b(startup founders|entrepreneur guests|founder interviews)\b/i, type: 'role', evidence: 'founder preference' },
    { pattern: /\b(published authors|bestselling authors|book writers)\b/i, type: 'professional', evidence: 'author preference' },
    { pattern: /\b(thought leaders|industry veterans|c-suite|executives only)\b/i, type: 'professional', evidence: 'executive requirement' },
  ];
  
  // Check combined patterns FIRST (before exclusive)
  for (const { pattern, type, evidence, requiresBoth } of combinedPatterns) {
    if (pattern.test(notes)) {
      requirements.class = 'effective'; // Treat as strong requirement
      requirements.type = type;
      requirements.evidence = evidence;
      requirements.patterns.push(evidence);
      requirements.requiresBoth = requiresBoth; // Store for validation
      return requirements;
    }
  }
  
  // Check exclusive patterns
  for (const { pattern, type, evidence } of exclusivePatterns) {
    if (pattern.test(notes)) {
      requirements.class = 'exclusive';
      requirements.type = type;
      requirements.evidence = evidence;
      requirements.patterns.push(evidence);
      return requirements;
    }
  }
  
  // Check preferential patterns
  for (const { pattern, type, evidence } of preferentialPatterns) {
    if (pattern.test(notes)) {
      requirements.class = 'preferential';
      requirements.type = type;
      requirements.evidence = evidence;
      requirements.patterns.push(evidence);
      // Continue checking for multiple preferences
    }
  }
  
  // Check for thematic patterns (general focus without guest restriction)
  const thematicPatterns = [
    /\b(diversity|inclusion|representation|underrepresented)\b/i,
    /\b(entrepreneurship|startup ecosystem|business leaders)\b/i,
  ];
  
  if (requirements.class === 'none') {
    for (const pattern of thematicPatterns) {
      if (pattern.test(notes)) {
        requirements.class = 'thematic';
        requirements.type = 'mixed';
        requirements.evidence = 'diversity/entrepreneurship theme';
        break;
      }
    }
  }
  
  return requirements;
}

// ---------------- Eligibility Gate (Post-Scoring) ----------------
function applyEligibilityGate(
  baseline_overall: number,
  guestRequirements: any,
  eligibilityResult: any,
  client: any
) {
  const req_class = guestRequirements.class; // 'exclusive' | 'preferential' | 'thematic' | 'none'
  
  // Distinguish "exclusive" (hard requirement, e.g., "women only") 
  // from "effective" (strong preference that impacts success)
  let final_class = req_class;
  if (req_class === 'exclusive') {
    const isHardExclusive = guestRequirements.evidence?.includes('only') || false;
    final_class = isHardExclusive ? 'exclusive' : 'effective';
  }
  
  const eligible = eligibilityResult.eligible;
  const confidence = eligibilityResult.confidence;
  
  // Default: no gate applied
  let action: 'pass' | 'conditional' | 'fail' | 'none' = 'none';
  let cap_to: number | null = null;
  let reasoning = '';
  let show_banner = false;
  let banner_message = '';
  
  // Gate logic
  if (final_class === 'none') {
    // No impact on score or UI
    action = 'none';
    reasoning = 'No guest requirements detected';
    
  } else if (final_class === 'preferential') {
    // Preferential requirements - check if client is CONFIRMED mismatch
    if (!eligible && confidence === 'high') {
      // Client confirmed NOT a match for preference
      action = 'fail';
      cap_to = 4.0; // Not as harsh as exclusive, but still penalize
      reasoning = `Client does not match show's preference: ${eligibilityResult.reasoning}`;
    } else if (eligible && confidence === 'high') {
      // Client confirmed match
      action = 'pass';
      reasoning = `Client aligns with show preference: ${eligibilityResult.reasoning}`;
    } else {
      // Unknown eligibility
      action = 'conditional';
      cap_to = 6.0;
      reasoning = `Unable to confirm if client matches show's preference for ${guestRequirements.evidence}. Please verify.`;
    }
    
  } else if (final_class === 'thematic') {
    // Thematic - soft recommendation only
    action = 'pass';
    reasoning = `Show has ${guestRequirements.evidence} theme. Consider if client aligns with this focus.`;
    
  } else if (final_class === 'exclusive' || final_class === 'effective') {
    // High-stakes requirements
    
    if (eligible && confidence === 'high') {
      // ✅ Confirmed match
      action = 'pass';
      reasoning = `Client confirmed eligible: ${eligibilityResult.reasoning}`;
      
    } else if (!eligible && confidence === 'high') {
      // ❌ Confirmed mismatch
      action = 'fail';
      cap_to = 3.0;
      reasoning = `Client does not meet ${final_class} requirement: ${eligibilityResult.reasoning}`;
      
    } else {
      // ⚠️ Unknown eligibility (low/medium confidence or missing data)
      action = 'conditional';
      cap_to = 6.0; // Provisional cap until resolved
      show_banner = true;
      banner_message = `This show has ${final_class} guest requirements (${guestRequirements.evidence}). ` +
        `We ${confidence === 'low' ? 'cannot determine' : 'have limited confidence in'} ` +
        `client eligibility from available data. Please confirm before pitching.`;
      reasoning = `Eligibility unclear for ${final_class} requirement: ${eligibilityResult.reasoning}`;
    }
  }
  
  // Apply cap if needed
  let final_overall = baseline_overall;
  if (cap_to !== null) {
    final_overall = Math.min(baseline_overall, cap_to);
  }
  
  return {
    final_overall: roundToHalf(clamp(final_overall, 0, 10)),
    gate: {
      class: final_class,
      action,
      evidence: guestRequirements.evidence || '',
      reasoning,
      cap_to,
      show_banner,
      banner_message,
      eligible_status: eligible ? 'eligible' : (confidence === 'low' ? 'unknown' : 'ineligible'),
      confidence,
    }
  };
}

// ---------------- Guest Eligibility Scoring ----------------
function scoreGuestEligibility(client: any, clientEnrichment: any, guestRequirements: any) {
  const requirements = guestRequirements;
  
  // CRITICAL CHANGE: Only score eligibility when requirements exist
  if (requirements.class === 'none') {
    return {
      score: null, // Don't include in weighted calculation
      reasoning: "No specific guest requirements detected",
      confidence: 'high' as const,
      eligible: true,
      shouldFlag: false,
      flagSeverity: null as 'critical' | 'high' | 'medium' | 'low' | null,
    };
  }
  
  // Use explicit client data first (from campaign manager input)
  const explicitGender = client?.gender;
  const identityTags = client?.guest_identity_tags || [];
  const credentials = client?.professional_credentials || [];
  
  // Fallback to enriched data from media kit if explicit data not available
  const clientTitle = clientEnrichment?.title?.toLowerCase() || '';
  const clientAchievements = clientEnrichment?.achievements || [];
  const clientIdentity = clientEnrichment?.identityMarkers || [];
  const inferredGender = clientEnrichment?.genderInference?.value || 'unknown';
  
  // Use explicit gender if available, otherwise fall back to inference
  const clientGender = explicitGender || inferredGender;
  const genderConfidence = explicitGender ? 'high' : (clientEnrichment?.genderInference?.confidence || 'low');
  
  let eligible = false;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let reasoning = '';
  
  // Check eligibility based on requirement type
  switch (requirements.type) {
    case 'gender':
      if (clientGender && clientGender !== 'unknown' && clientGender !== 'unspecified') {
        confidence = genderConfidence;
        if (requirements.evidence.includes('women') || requirements.evidence.includes('female')) {
          eligible = clientGender === 'female';
          reasoning = eligible ? 'Client identified as female' : 'Client not identified as female';
        } else if (requirements.evidence.includes('men') || requirements.evidence.includes('male')) {
          eligible = clientGender === 'male';
          reasoning = eligible ? 'Client identified as male' : 'Client not identified as male';
        }
      } else {
        reasoning = 'Client gender not specified or could not be determined';
      }
      break;
      
    case 'role':
      if (requirements.evidence.includes('founder')) {
        eligible = credentials.includes('founder') || clientAchievements.includes('founder') || clientTitle.includes('founder');
        reasoning = eligible ? 'Client identified as founder' : 'Client not identified as founder';
        confidence = credentials.includes('founder') ? 'high' : (clientTitle ? 'medium' : 'low');
      } else if (requirements.evidence.includes('ceo')) {
        eligible = credentials.includes('ceo') || clientAchievements.includes('ceo') || clientTitle.includes('ceo');
        reasoning = eligible ? 'Client identified as CEO' : 'Client not identified as CEO';
        confidence = credentials.includes('ceo') ? 'high' : (clientTitle ? 'medium' : 'low');
      }
      break;
      
    case 'professional':
      if (requirements.evidence.includes('author')) {
        eligible = credentials.includes('published_author') || credentials.includes('author') || clientAchievements.includes('author');
        reasoning = eligible ? 'Client identified as published author' : 'Client not identified as published author';
        confidence = credentials.includes('published_author') || credentials.includes('author') ? 'high' : 'medium';
      } else if (requirements.evidence.includes('executive')) {
        eligible = credentials.includes('ceo') || credentials.includes('industry_veteran') || clientAchievements.includes('ceo');
        reasoning = eligible ? 'Client identified as executive/industry veteran' : 'Client not identified as executive';
        confidence = credentials.length > 0 ? 'high' : 'medium';
      }
      break;
      
    case 'identity':
      if (requirements.evidence.includes('veteran')) {
        eligible = identityTags.includes('veteran') || clientAchievements.includes('veteran');
        reasoning = eligible ? 'Client identified as veteran' : 'Client not identified as veteran';
        confidence = identityTags.includes('veteran') ? 'high' : 'medium';
      } else if (requirements.evidence.includes('lgbtq')) {
        eligible = identityTags.includes('lgbtq+') || clientIdentity.includes('lgbtq+');
        reasoning = eligible ? 'Client identified as LGBTQ+' : 'Client not identified as LGBTQ+';
        confidence = identityTags.includes('lgbtq+') ? 'high' : 'low';
      } else if (requirements.evidence.includes('black')) {
        eligible = identityTags.includes('black_founder') || identityTags.includes('black') || clientIdentity.includes('black');
        reasoning = eligible ? 'Client identified as Black' : 'Client not identified as Black';
        confidence = identityTags.some(t => t.includes('black')) ? 'high' : 'low';
      } else if (requirements.evidence.includes('hispanic')) {
        eligible = identityTags.some(t => t.includes('hispanic') || t.includes('latino') || t.includes('latina'));
        reasoning = eligible ? 'Client identified as Hispanic/Latino' : 'Client not identified as Hispanic/Latino';
        confidence = eligible ? 'high' : 'low';
      } else if (requirements.evidence.includes('christian')) {
        eligible = identityTags.includes('christian') || clientIdentity.includes('christian');
        reasoning = eligible ? 'Client has Christian background' : 'Client Christian background unclear';
        confidence = identityTags.includes('christian') ? 'high' : 'low';
      }
      break;
      
    case 'ideology':
      if (requirements.evidence.includes('conservative')) {
        eligible = identityTags.includes('conservative') || identityTags.includes('right_wing');
        reasoning = eligible ? 'Client aligns with conservative values' : 'Client political alignment unclear';
        confidence = eligible ? 'high' : 'low';
      } else if (requirements.evidence.includes('progressive')) {
        eligible = identityTags.includes('progressive') || identityTags.includes('liberal');
        reasoning = eligible ? 'Client aligns with progressive values' : 'Client political alignment unclear';
        confidence = eligible ? 'high' : 'low';
      }
      break;
      
    case 'mixed':
      // Combined requirements - ALL must be met
      if (requirements.requiresBoth) {
        let allMet = true;
        let missingReqs: string[] = [];
        
        for (const req of requirements.requiresBoth) {
          const [category, value] = req.split(':');
          
          if (category === 'gender') {
            if (clientGender !== value && clientGender !== 'unspecified') {
              allMet = false;
              missingReqs.push(`not ${value}`);
            } else if (clientGender === 'unspecified' || clientGender === 'unknown') {
              confidence = 'low';
              missingReqs.push('gender unknown');
            }
          } else if (category === 'identity') {
            const hasIdentity = identityTags.some(tag => 
              tag.includes(value) || tag === value
            ) || clientIdentity.some(id => id.includes(value));
            
            if (!hasIdentity) {
              allMet = false;
              missingReqs.push(`not identified as ${value}`);
            }
          }
        }
        
        eligible = allMet;
        confidence = (clientGender && clientGender !== 'unknown' && identityTags.length > 0) ? 'high' : 'medium';
        reasoning = eligible 
          ? `Client meets combined requirement: ${requirements.evidence}` 
          : `Client does not meet requirement: ${missingReqs.join(', ')}`;
      }
      break;
  }
  
  // Calculate score and flags based on requirement class and eligibility
  let score = 7.0; // Default neutral
  let shouldFlag = false;
  let flagSeverity: 'critical' | 'high' | 'medium' | 'low' | null = null;
  
  if (requirements.class === 'exclusive') {
    if (eligible && confidence === 'high') {
      score = 10.0; // Perfect match for exclusive requirement
      shouldFlag = false;
    } else if (eligible && confidence === 'medium') {
      score = 8.5; // Good match but some uncertainty
      shouldFlag = true;
      flagSeverity = 'medium';
      reasoning = `${reasoning} (medium confidence - verify before pitching)`;
    } else if (!eligible && confidence === 'high') {
      score = 0.5; // Clear mismatch for exclusive requirement - HARD BLOCKER
      shouldFlag = true;
      flagSeverity = 'critical';
      reasoning = `${reasoning} - Does not meet exclusive guest requirement`;
    } else {
      score = 5.0; // Unknown eligibility for exclusive requirement - MANUAL REVIEW
      shouldFlag = true;
      flagSeverity = 'high';
      reasoning = `${reasoning} - Cannot verify eligibility, manual review required`;
    }
  } else if (requirements.class === 'preferential') {
    if (eligible && confidence === 'high') {
      score = 9.0; // Strong match for preference
      shouldFlag = false;
    } else if (eligible && confidence === 'medium') {
      score = 8.0; // Good match for preference
      shouldFlag = true;
      flagSeverity = 'low';
      reasoning = `${reasoning} (verify for best results)`;
    } else if (!eligible && confidence === 'high') {
      score = 4.0; // Lower score for confirmed mismatch
      shouldFlag = true;
      flagSeverity = 'high'; // Flag as high severity
      reasoning = `${reasoning} - Client does not match show's strong preference`;
    } else {
      score = 6.0; // Unknown but less critical for preferences
      shouldFlag = true;
      flagSeverity = 'medium';
      reasoning = `${reasoning} - Preference unclear`;
    }
  } else if (requirements.class === 'thematic') {
    score = 7.0; // Neutral - thematic doesn't require specific guests
    reasoning = 'Thematic focus but no specific guest requirements';
    shouldFlag = false;
  }
  
  return {
    score: roundToHalf(clamp(score, 0, 10)),
    reasoning,
    confidence,
    eligible: eligible || requirements.class !== 'exclusive',
    shouldFlag,
    flagSeverity,
  };
}

// ---------------- Heuristic Scorer (Goal-centric) ----------------
async function scoreGoalCentric(client: any, show_notes: string, consumerCues: string[] = []) {
  const notes: string = String(show_notes || "");
  console.log('[ANALYZE v2.0] scoreGoalCentric called - notes length:', notes.length);
  console.log('[ANALYZE v2.0] Consumer cues provided to scoreGoalCentric:', consumerCues.length);
  const tokens = tokenize(notes);
  const { strong, near } = expandConcepts(client);
  const audiences: string[] = (client?.target_audiences || client?.target_roles || []) as string[];
  const avoids: string[] = (client?.avoid || client?.keywords_negative || []) as string[];
  const notesPref: string = String(client?.notes || client?.campaign_strategy || "");
  const mediaKitUrl: string = String(client?.media_kit_url || "");
  
  // Enrich client data from media kit
  const clientEnrichment = await enrichClientData(mediaKitUrl);
  
  // Detect guest requirements from show notes
  const guestRequirements = detectGuestRequirements(notes);
  
  // Score guest eligibility (pass both explicit client data and enriched data)
  const eligibilityResult = scoreGuestEligibility(client, clientEnrichment, guestRequirements);

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

  // Topic relevance (0.30)
  const weightedConceptScore = clamp(Math.min(10, strongHits.length * 2 + nearHits.length * 1));
  console.log(`[CONCEPT DEBUG] Strong hits (${strongHits.length}):`, strongHits.map(h => h.term).join(', '));
  console.log(`[CONCEPT DEBUG] Near hits (${nearHits.length}):`, nearHits.map(h => h.term).join(', '));
  
  let topicRelevance = roundToHalf(clamp(2 + weightedConceptScore * 0.5));
  
  // Concept density multiplier: reward shows with exceptional thematic depth
  if (strongHits.length >= 8) {
    topicRelevance = Math.min(10.0, topicRelevance * 1.25); // 8+ strong hits → 1.25x
  } else if (strongHits.length >= 5) {
    topicRelevance = Math.min(10.0, topicRelevance * 1.15); // 5-7 strong hits → 1.15x
  }
  topicRelevance = roundToHalf(topicRelevance);

  // ICP alignment (0.45) - UPDATED: more permissive for "security pros/practitioners" with enterprise themes
  const audStrong = findPositions(notes, audiences.map(norm)).length;
  const audAdj = nearHits.filter(h => audiences.some(a => norm(h.term).includes(norm(a)))).length;
  let icpAlignment = roundToHalf(clamp(2 + Math.min(7, audStrong * 2 + Math.min(2, audAdj * 0.5))));
  
  // Count enterprise cues and apply lift BEFORE weighted calculation
  const enterpriseCueCount = countEnterpriseCues(notes);
  
  // Apply enterprise cue lift to ICP early (before weighted mean)
  if (enterpriseCueCount >= 4) {
    icpAlignment = Math.min(10.0, icpAlignment + 1.0);
  } else if (enterpriseCueCount >= 2) {
    icpAlignment = Math.min(10.0, icpAlignment + 0.5);
  }
  
  // NEW: Allow broad "security pros/practitioners" to score 7.5-8.5 if enterprise themes present
  const hasSecurityPractitionerAudience = /(security\s+(pros?|professionals?|practitioners?|experts?))/i.test(notes);
  const hasEnterpriseThemes = /(breach|identity|ransomware|zero\s*trust|cloud\s*security|soc|risk|compliance)/i.test(notes);
  if (hasSecurityPractitionerAudience && hasEnterpriseThemes && icpAlignment < 7.5) {
    icpAlignment = Math.max(icpAlignment, 7.5);
  }
  
  // Only penalize ICP when audience is consumer/entry-level or purely hobbyist
  const hasConsumerAudience = consumerCues.length > 0 || /(consumer|lifestyle|hobbyist|entry[\s-]?level|beginner|personal\s+tech)/i.test(notes);
  if (hasConsumerAudience && icpAlignment > 6.0) {
    icpAlignment = Math.min(icpAlignment, 6.0);
  }

  // CTA synergy (0.20)
  const ctaTerms = ["book","demo","consult","download","guide","report","contact","learn more","talk to","sales","trial","start"];
  const ctaOverlap = count(notes, ctaTerms);
  const enterpriseVibe = /(enterprise|b2b|ciso|cio|governance|compliance|risk|security)/i.test(notes) ? 1 : 0;
  const ctaSynergy = roundToHalf(clamp(2 + Math.min(7, ctaOverlap * 1.5 + enterpriseVibe * 2)));

  // Brand suitability (0.10) - UPDATED: tolerate humor unless client requires formal tone
  const tonePref = norm(notesPref);
  const tonePos = ["authoritative","technical","tactical","educational","interview","case study","no pay-to-play"].filter(t => tonePref.includes(t)).length;
  const toneNegInNotes = /(explicit|nsfw|politics|gambling|hype|clickbait)/i.test(notes) ? 1 : 0;
  const hasHumor = /(humor|funny|comedic|lighthearted)/i.test(notes);
  const requiresFormal = /(formal\s+only|enterprise[\s-]?only\s+tone)/i.test(tonePref);
  const isProfessionalContent = /(accurate|ethical|professional|credible)/i.test(notes) && toneNegInNotes === 0;
  
  let brandSuitability = roundToHalf(clamp(4 + tonePos * 1.2 - toneNegInNotes * 2));
  
  // NEW: If humor detected but client doesn't require formal AND content is professional → clamp Brand ≥ 7.5
  if (hasHumor && !requiresFormal && isProfessionalContent && brandSuitability < 7.5) {
    brandSuitability = 7.5;
  }

  // NEW: Audience-first weights (CTA is info-only, not scored)
  const weights = { topic: 0.45, icp: 0.45, brand: 0.10 } as const;
  
  const weighted_mean = 
    topicRelevance * weights.topic + 
    icpAlignment * weights.icp + 
    brandSuitability * weights.brand;

  // Adjustments
  const applied_adjustments: { type: 'cap'|'floor'|'penalty'|'bonus'; label: string; amount?: number }[] = [];
  let adj_genericness = 0;
  const nonGenericCount = nonGenericQuotes.length;
  if (nonGenericCount <= 0) { adj_genericness = -1.5; }
  else if (nonGenericCount === 1) { adj_genericness = -1.0; }
  else if (nonGenericCount === 2) { adj_genericness = -0.5; }
  if (adj_genericness) applied_adjustments.push({ type: 'penalty', label: 'Genericness', amount: adj_genericness });

  // Track enterprise cue lift in audit trail (already applied above)
  if (enterpriseCueCount >= 4) {
    applied_adjustments.push({ type: 'bonus', label: 'Enterprise cues (4+)', amount: 1.0 });
  } else if (enterpriseCueCount >= 2) {
    applied_adjustments.push({ type: 'bonus', label: 'Enterprise cues (2+)', amount: 0.5 });
  }

  let adj_multi_concept = 0;
  if (distinctConcepts >= 5) adj_multi_concept = +0.5;
  else if (distinctConcepts >= 3) adj_multi_concept = +0.3;
  if (adj_multi_concept) applied_adjustments.push({ type: 'bonus', label: 'Multi-concept', amount: adj_multi_concept });

  // Cadence bonus removed per new policy
  const adj_cadence = 0;

  let overall = clamp(weighted_mean + adj_genericness + adj_multi_concept, 0, 10);

  // === AGGREGATION RULES (audience-first) ===
  const minTopicIcp = Math.min(topicRelevance, icpAlignment);
  const topicIcpGap = Math.abs(topicRelevance - icpAlignment);

  // Rule 1: If min(Topic, ICP) ≤ 4 → cap final ≤ 5.5
  if (minTopicIcp <= 4) {
    overall = Math.min(overall, 5.5);
    applied_adjustments.push({ 
      type: 'cap', 
      label: 'Weak topic or audience fit', 
      amount: 5.5 
    });
  }

  // Rule 2: If Topic ≥ 8 AND ICP ≥ 8 AND Brand ≤ 5 → apply penalty
  if (topicRelevance >= 8 && icpAlignment >= 8 && brandSuitability <= 5) {
    const brandPenalty = brandSuitability <= 4 ? -1.0 : -0.5;
    overall = Math.max(0, overall + brandPenalty);
    applied_adjustments.push({ 
      type: 'penalty', 
      label: 'Brand quality concern', 
      amount: brandPenalty 
    });
  }
  // Rule 2b: If Topic ≥ 8 AND ICP ≥ 8 → ensure final ≥ 7.5 (unless brand killed it) - BEFORE influence multiplier
  else if (topicRelevance >= 8 && icpAlignment >= 8) {
    overall = Math.max(overall, 7.5);
    applied_adjustments.push({ 
      type: 'floor', 
      label: 'Strong topic + audience fit', 
      amount: 7.5 
    });
  }
  
  // Exceptional Fit Bonus (+0.5-1.5): reward objectively outstanding episodes
  // Apply when: Topic ≥ 8.0, ICP ≥ 8.0, Brand ≥ 7.0, no gaps, no risks
  const hasNoGaps = why_not_fit.length === 0;
  const hasNoRisks = risk_flags_structured.filter(r => r.severity === 'Red' || r.severity === 'Amber').length === 0;
  
  if (topicRelevance >= 8.0 && icpAlignment >= 8.0 && brandSuitability >= 7.0 && hasNoGaps && hasNoRisks) {
    // Tier 1: Perfect fundamentals (9.0+/9.0+/8.5+) → +1.5
    if (topicRelevance >= 9.0 && icpAlignment >= 9.0 && brandSuitability >= 8.5) {
      overall = Math.min(10, overall + 1.5);
      applied_adjustments.push({ 
        type: 'bonus', 
        label: 'Exceptional fit (9+/9+/8.5+, no issues)', 
        amount: 1.5 
      });
    } 
    // Tier 2: Very strong (8.5+/8.5+/7.5+) → +1.0
    else if (topicRelevance >= 8.5 && icpAlignment >= 8.5 && brandSuitability >= 7.5) {
      overall = Math.min(10, overall + 1.0);
      applied_adjustments.push({ 
        type: 'bonus', 
        label: 'Exceptional fit (8.5+/8.5+/7.5+, no issues)', 
        amount: 1.0 
      });
    }
    // Tier 3: Strong clean fit (8.0+/8.0+/7.0+) → +0.5
    else {
      overall = Math.min(10, overall + 0.5);
      applied_adjustments.push({ 
        type: 'bonus', 
        label: 'Clean fit (8+/8+/7+, no issues)', 
        amount: 0.5 
      });
    }
  }
  
  // Store baseline before influence multiplier
  const baseline_overall = overall;
  
  // NEW: Extract influence signals and calculate multiplier
  const influenceSignals = extractInfluenceSignals(notes);
  const influence_m = calculateInfluenceMultiplier(influenceSignals);
  
  // Apply influence multiplier to baseline
  if (influence_m !== 1.0) {
    overall = clamp(overall * influence_m, 0, 10);
    applied_adjustments.push({
      type: 'bonus',
      label: `Influence multiplier (${influence_m.toFixed(2)}x)`,
      amount: overall - baseline_overall,
    });
  }
  const post_influence_score = overall;
  
  // Declare cap variables BEFORE they're used
  let cap_applied = false;
  let cap_type: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'none' = 'none';
  let cap_evidence = '';
  let cap_reason: string | undefined;
  
  // Rule 2c: Near-Strong Floor - if Topic ≥ 8.0 AND ICP ≥ 7.0 AND Brand ≥ 7.0 AND no hard caps
  const hasHardCap = cap_applied && (cap_type === 'avoid' || cap_type === 'pay_to_play' || cap_type === 'link_ban' || cap_type === 'zero_overlap');
  if (topicRelevance >= 8.0 && icpAlignment >= 7.0 && brandSuitability >= 7.0 && !hasHardCap) {
    overall = Math.max(overall, 7.5);
    applied_adjustments.push({ 
      type: 'floor', 
      label: 'Near-strong foundation (8/7/7)', 
      amount: 7.5 
    });
  }

  // Rule 3: If Brand ≤ 4 → cap final ≤ 6.0
  if (brandSuitability <= 4) {
    overall = Math.min(overall, 6.0);
    applied_adjustments.push({ 
      type: 'cap', 
      label: 'Brand suitability concern', 
      amount: 6.0 
    });
  }

  // Rule 4: If |Topic − ICP| ≥ 3.5 → apply -0.25 penalty (softened)
  if (topicIcpGap >= 3.5) {
    overall = Math.max(0, overall - 0.25);
    const gapType = topicRelevance > icpAlignment 
      ? 'High concept / weaker audience match' 
      : 'Audience present / weak topical depth';
    applied_adjustments.push({ 
      type: 'penalty', 
      label: gapType, 
      amount: -0.25 
    });
  }

  // Apply final clamp
  overall = clamp(overall, 0, 10);

  // Caps (evidence-gated, apply at most one)
  const avoidCounts = avoids.map(a => ({ a, c: count(notes, [a]) })).sort((x,y)=>y.c - x.c);
  const strongAvoidCentral = (avoidCounts[0]?.c || 0) >= 2;
  const payToPlayMatch = notes.match(/(sponsored by|paid placement|advertorial|pay\s*to\s*play)/i);
  const linkBanMatch = notes.match(/(no\s+links|do\s+not\s+include\s+links|don['']t\s+include\s+urls|no\s+urls)/i);
  const consumerCue = /(giveaway|coupon|subscribe and save|lifestyle|beauty|fashion|fitness|cooking|parenting|celebrity|gossip)/i.test(notes);
  const b2cMismatch = consumerCue && !enterpriseVibe;

  // (cap variables now declared earlier at line ~819)

  const tryApplyCap = (type: typeof cap_type, evidence: string, capMax = 5.0) => {
    if (cap_applied) return;
    cap_applied = true; cap_type = type; cap_evidence = evidence || ''; overall = Math.min(overall, capMax);
    applied_adjustments.push({ type: 'cap', label: `${type.replace(/_/g,' ')}`, amount: capMax });
    cap_reason = `${type.replace(/_/g,' ')} — "${evidence || 'evidence required'}"`;
  };

  // Domain clash: crypto content vs education-focused client → hard cap 1.0
  const cryptoCue = /(crypto|bitcoin|blockchain|defi|web3|ethereum|nft|solana|token\b|altcoin)/i.test(notes);
  const clientText = norm([
    client?.name,
    client?.company,
    ...(client?.target_audiences || []),
    ...(client?.talking_points || []),
    client?.notes,
    client?.campaign_strategy,
  ].filter(Boolean).join(' '));
  const isEducationClient = /(k-?12|education|edtech|teacher|classroom|school|students|district|principal|superintendent|curriculum|pedagogy|literacy|numeracy)/i.test(clientText);

  if (cryptoCue && isEducationClient) {
    if (!cap_applied) {
      cap_applied = true; cap_type = 'avoid'; cap_evidence = 'crypto domain content conflicts with education ICP';
      overall = Math.min(overall, 1.0);
      applied_adjustments.push({ type: 'cap', label: 'avoid', amount: 1.0 });
      cap_reason = 'avoid — "crypto domain conflict with education ICP"';
    }
  } else if (strongAvoidCentral) {
    tryApplyCap('avoid', avoidCounts[0].a);
  } else if (payToPlayMatch) {
    tryApplyCap('pay_to_play', payToPlayMatch[0]);
  } else if (linkBanMatch) {
    tryApplyCap('link_ban', linkBanMatch[0]);
  } else if (b2cMismatch) {
    tryApplyCap('b2c_mismatch', 'consumer-only cues without enterprise signals');
  } else if (conceptHitsCount === 0 && topicRelevance <= 5.0) {
    tryApplyCap('zero_overlap', 'No relevant terms detected', 2.0);
  }

  // Calibration invariants
  const criticalCap = cap_applied && (cap_type === 'avoid' || cap_type === 'pay_to_play' || cap_type === 'link_ban' || cap_type === 'b2c_mismatch' || cap_type === 'zero_overlap');
  if (!criticalCap && topicRelevance >= 8 && icpAlignment >= 7 && brandSuitability >= 7) {
    overall = Math.max(overall, 7.0);
  }
  if (!criticalCap && overall < (weighted_mean - 2.0)) {
    overall = weighted_mean - 2.0;
  }

  const final_overall = roundToHalf(clamp(overall, 0, 10));

  // Apply eligibility gate AFTER baseline score
  const gateResult = applyEligibilityGate(
    final_overall,
    guestRequirements,
    eligibilityResult,
    client
  );

  overall = gateResult.final_overall;

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

  // Consumer cues now passed as parameter to avoid scoping issues

  const why_not_fit_structured: { severity: 'Red' | 'Amber' | 'Green'; claim: string; evidence: string; interpretation: string }[] = [];
  if (cap_type === 'avoid') {
    const avoidA = avoidCounts[0]?.a;
    const claim = avoidA ? `Contains avoid term: "${avoidA}"` : 'Critical conflict with avoid criteria';
    const evidence = cap_evidence || avoidA || 'domain conflict';
    why_not_fit_structured.push({ severity: 'Red', claim, evidence, interpretation: 'Central to episode; brand/scope conflict' });
  }
  if (cap_type === 'pay_to_play') {
    why_not_fit_structured.push({ severity: 'Red', claim: 'Pay-to-play indications', evidence: cap_evidence || 'sponsored by', interpretation: 'Editorial independence risk' });
  }
  if (cap_type === 'link_ban') {
    why_not_fit_structured.push({ severity: 'Amber', claim: 'Link ban present', evidence: cap_evidence, interpretation: 'Limits CTA effectiveness' });
  }
  if (cap_type === 'b2c_mismatch') {
    why_not_fit_structured.push({ severity: 'Red', claim: 'B2C mismatch (hard cap)', evidence: cap_evidence, interpretation: 'Consumer-focused content with NO enterprise signals - misaligned with enterprise ICP' });
  } else if (consumerCues.length >= 1 && enterpriseCueCount < 2) {
    // Surface as concern but don't cap if some enterprise cues present
    why_not_fit_structured.push({ severity: 'Amber', claim: 'Consumer content detected', evidence: `Consumer cues: ${consumerCues.slice(0,2).join(', ')}`, interpretation: 'Mixed audience may dilute enterprise messaging' });
  }
  if (cap_type === 'zero_overlap') {
    why_not_fit_structured.push({ severity: 'Amber', claim: 'No overlap with concept sets', evidence: 'No relevant terms detected', interpretation: 'Topic/theme mismatch; low relevance' });
  }
  if (!strongAudienceEvidence) {
    why_not_fit_structured.push({ severity: 'Green', claim: 'Audience specificity is weak', evidence: 'Lacks clear role/industry cues', interpretation: 'Proceed only if host confirms ICP details' });
  }

  // NOTE: Eligibility is now ONLY in risks, NOT in why_not_fit (de-duplication)

  // === NEW OPERATIONAL RISK TAXONOMY (Red/Amber/Green) ===
  const risk_flags_structured: { severity: 'Red' | 'Amber' | 'Green'; flag: string; evidence: string; mitigation: string }[] = [];
  
  // RED (dealbreakers)
  // Reuse payToPlayMatch from line 859
  if (payToPlayMatch) {
    risk_flags_structured.push({ 
      severity: 'Red', 
      flag: 'Pay-to-play / guest fees detected', 
      evidence: payToPlayMatch[0],
      mitigation: 'DO NOT PITCH - Confirm editorial policy or negotiate earned placement'
    });
  }
  
  if (linkBanMatch) {
    risk_flags_structured.push({ 
      severity: 'Red', 
      flag: 'Link/UTM ban or strict no-external links', 
      evidence: linkBanMatch[0],
      mitigation: 'Ask for link in show notes or episode page; may limit CTA ROI'
    });
  }
  
  const noGuestsMatch = notes.match(/(no\s+guest\s+submissions|invite\s+only|co-hosts\s+only|not\s+accepting\s+guests|closed\s+to\s+guests)/i);
  if (noGuestsMatch) {
    risk_flags_structured.push({ 
      severity: 'Red', 
      flag: 'No guest submissions / invite-only', 
      evidence: noGuestsMatch[0],
      mitigation: 'DO NOT PITCH - Show does not accept guest pitches'
    });
  }
  
  if (gateResult.gate.action === 'fail') {
    risk_flags_structured.push({ 
      severity: 'Red', 
      flag: `Eligibility mismatch: ${guestRequirements.evidence}`, 
      evidence: gateResult.gate.reasoning,
      mitigation: 'DO NOT PITCH - Client does not meet exclusive requirements'
    });
  }

  // Controversial/polarizing content
  const controversialMatch = notes.match(/(political\s+views|religious\s+content|partisan|controversial|polarizing|culture\s+war)/i);
  if (controversialMatch) {
    risk_flags_structured.push({
      severity: 'Red',
      flag: 'Potentially controversial or polarizing content',
      evidence: controversialMatch[0],
      mitigation: 'Assess brand risk; may alienate segments of target audience'
    });
  }
  
  // AMBER (strategic concerns)
  const formOnlyMatch = notes.match(/(contact\s+form|submission\s+form|google\s+form|typeform)/i);
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(notes);
  if (formOnlyMatch && !hasEmail) {
    risk_flags_structured.push({ 
      severity: 'Amber', 
      flag: 'No direct contact - form only', 
      evidence: formOnlyMatch[0],
      mitigation: 'Use guest intake form; may slow response time'
    });
  }
  
  const staleMatch = notes.match(/(no\s+longer\s+publishing|on\s+hiatus|inactive|discontinued|final\s+episode)/i);
  if (staleMatch) {
    risk_flags_structured.push({ 
      severity: 'Amber', 
      flag: 'Show may be inactive or discontinued', 
      evidence: staleMatch[0],
      mitigation: 'Verify active status before pitching'
    });
  }
  
  const promoMatch = notes.match(/(promotional\s+content|sponsored\s+segments|product\s+placement|paid\s+endorsement|affiliate\s+links)/gi);
  if (promoMatch && promoMatch.length >= 2) {
    risk_flags_structured.push({ 
      severity: 'Amber', 
      flag: 'Heavy promotional/sales format detected', 
      evidence: promoMatch.slice(0,2).join('; '),
      mitigation: 'Ensure thought-leadership angle; avoid pure product pitch'
    });
  }

  // Content depth & format mismatches
  const narrativeMatch = notes.match(/(personal\s+journey|founder\s+story|transformation\s+story|life\s+story|origin\s+story)/i);
  const tacticalNeeds = (client.talking_points || []).some((tp: string) => 
    /framework|methodology|tactic|strategy|implementation|process|how\s+to/i.test(tp)
  );
  if (narrativeMatch && tacticalNeeds) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Content format: narrative-driven vs tactical needs',
      evidence: `${narrativeMatch[0]}; client needs tactical frameworks`,
      mitigation: 'Pitch client\'s journey angle rather than deep technical dive'
    });
  }

  const beginnerMatch = notes.match(/(beginner|101|getting\s+started|basics|introduction\s+to|first\s+steps)/i);
  const seniorTarget = (client.target_audiences || []).some((aud: string) => 
    /c-suite|executive|vp|director|senior|experienced|expert/i.test(aud)
  );
  if (beginnerMatch && seniorTarget) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Expertise level mismatch - beginner focus vs senior target',
      evidence: `${beginnerMatch[0]}; client targets ${(client.target_audiences || []).join(', ')}`,
      mitigation: 'Frame pitch around lessons for senior leaders, not fundamentals'
    });
  }

  const shortEpisodeMatch = notes.match(/(\d+)\s*min/i);
  if (shortEpisodeMatch && parseInt(shortEpisodeMatch[1]) < 20) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Short episode format - may limit depth',
      evidence: `${shortEpisodeMatch[0]} episodes`,
      mitigation: 'Focus pitch on concise, high-impact talking points'
    });
  }
  
  // Audience sophistication mismatches
  const consumerHeavy = notes.match(/(your\s+business|small\s+business|solopreneur|freelancer|side\s+hustle)/gi);
  const enterpriseTarget = (client.target_audiences || []).some((aud: string) => 
    /enterprise|fortune|mid-market|b2b|saas/i.test(aud)
  );
  if (consumerHeavy && consumerHeavy.length >= 3 && enterpriseTarget) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Audience seniority mismatch - consumer-focused vs enterprise target',
      evidence: `Heavy consumer language: ${consumerHeavy.slice(0,2).join(', ')}`,
      mitigation: 'Emphasize enterprise angle; verify ICP with host before pitching'
    });
  }

  const aspiringMatch = notes.match(/(aspiring|first-time|new\s+to|starting\s+out|early\s+stage)/i);
  if (aspiringMatch && seniorTarget) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Junior audience focus vs senior decision-maker needs',
      evidence: aspiringMatch[0],
      mitigation: 'Position client as mentor/advisor sharing advanced insights'
    });
  }

  // Audience dilution (consumer content mixed with enterprise cues)
  if (consumerCues.length >= 1 && enterpriseCueCount >= 2) {
    risk_flags_structured.push({ 
      severity: 'Amber', 
      flag: 'Audience dilution - mixed consumer/enterprise signals', 
      evidence: `Consumer: ${consumerCues.slice(0,2).join(', ')}; Enterprise cues present`,
      mitigation: 'Focus pitch on enterprise angle; verify ICP fit with host'
    });
  }
  
  const irregularMatch = notes.match(/(irregular\s+schedule|sporadic|infrequent|monthly|quarterly)/i);
  if (irregularMatch) {
    risk_flags_structured.push({ 
      severity: 'Amber', 
      flag: 'Low or irregular episode frequency', 
      evidence: irregularMatch[0],
      mitigation: 'May have longer lead time; verify active production schedule'
    });
  }

  // Brand tone concerns
  const casualMatch = notes.match(/(unedited|raw\s+conversations|unfiltered|casual\s+chat|no\s+prep)/i);
  const professionalBrand = client.notes && /professional|corporate|polished|premium|enterprise/i.test(client.notes);
  if (casualMatch && professionalBrand) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Production quality: casual/raw format vs professional brand positioning',
      evidence: casualMatch[0],
      mitigation: 'Verify brand fit; ensure content aligns with professional image'
    });
  }

  // Content recency
  const outdatedMatch = notes.match(/(2019|2020|2021|legacy|outdated|deprecated)/i);
  if (outdatedMatch) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Content recency concern - references outdated frameworks/tech',
      evidence: outdatedMatch[0],
      mitigation: 'Verify episode is recent and content is current'
    });
  }
  
  if (gateResult.gate.action === 'conditional') {
    risk_flags_structured.push({ 
      severity: 'Amber', 
      flag: `Guest eligibility requires verification: ${guestRequirements.evidence}`, 
      evidence: gateResult.gate.reasoning,
      mitigation: 'Confirm eligibility with campaign manager before pitching'
    });
  }

  // Pitch strategy concerns
  const warmIntroMatch = notes.match(/(referral\s+only|warm\s+intro|personal\s+connection|invitation\s+only)/i);
  if (warmIntroMatch) {
    risk_flags_structured.push({
      severity: 'Amber',
      flag: 'Prefers warm introductions over cold pitches',
      evidence: warmIntroMatch[0],
      mitigation: 'Seek mutual connection or referral before pitching'
    });
  }
  
  // GREEN (positive signals)
  const bookingLinkMatch = notes.match(/(booking\s+link|guest\s+intake|apply\s+to\s+be\s+a\s+guest|pitch\s+form|guest\s+application)/i);
  if (bookingLinkMatch) {
    risk_flags_structured.push({ 
      severity: 'Green', 
      flag: 'Guest-friendly: booking/intake process available', 
      evidence: bookingLinkMatch[0],
      mitigation: 'Use provided guest intake process for streamlined submission'
    });
  }
  
  if (hasEmail && !formOnlyMatch) {
    risk_flags_structured.push({ 
      severity: 'Green', 
      flag: 'Direct contact available', 
      evidence: 'Email found in show notes',
      mitigation: 'Pitch directly via email with personalized angle'
    });
  }

  const recentMatch = notes.match(/(recent|latest|new\s+episode|just\s+published|this\s+week)/i);
  if (recentMatch) {
    risk_flags_structured.push({
      severity: 'Green',
      flag: 'Active publishing schedule confirmed',
      evidence: recentMatch[0],
      mitigation: 'Show is actively producing; timely pitch opportunity'
    });
  }

  const diverseMatch = notes.match(/(diverse\s+guests|wide\s+range|variety\s+of|different\s+backgrounds)/i);
  if (diverseMatch) {
    risk_flags_structured.push({
      severity: 'Green',
      flag: 'Open to diverse guest perspectives',
      evidence: diverseMatch[0],
      mitigation: 'Highlight unique perspective or background in pitch'
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
  const summary_text = buildSummary({ 
    overall: overall, 
    verdict, 
    why_fit_structured, 
    why_not_fit_structured, 
    risk_flags_structured, 
    clientName: client?.name || client?.company || 'the client',
    influence_m,
    influenceSignals,
  });

  // NEW: Rubric with 3 scored dimensions + 1 info-only (CTA)
  const rubric_breakdown = [
    { dimension: "Topic relevance", weight: 0.45, raw_score: topicRelevance, notes: citations.slice(0, 3).join("; ") || "No specific matches" },
    { dimension: "ICP alignment", weight: 0.45, raw_score: icpAlignment, notes: audStrong ? `${audStrong} audience hits` : "Weak audience signals" },
    { dimension: "Brand suitability", weight: 0.10, raw_score: brandSuitability, notes: toneNegInNotes ? "Tone concerns detected" : "Appropriate brand fit" },
    { dimension: "Format/CTA notes", weight: 0, raw_score: ctaSynergy, notes: enterpriseVibe ? "Enterprise tone supports B2B CTA" : `${ctaOverlap} CTA terms (info only)` },
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
    // NEW: Audit object with baseline, final, eligibility gate, influence multiplier, and enterprise cues
    audit: {
      baseline_overall,
      influence_multiplier: influence_m,
      influence_signals: influenceSignals,
      post_influence_score,
      final_overall,
      gated_overall: overall,
      weighted_mean,
      adjustments: { genericness: adj_genericness, multi_concept: adj_multi_concept, cadence: adj_cadence },
      cap_applied,
      cap_type,
      cap_evidence,
      enterprise_cues_count: enterpriseCueCount,
      eligibility: gateResult.gate,
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
  influence_m?: number;
  influenceSignals?: ReturnType<typeof extractInfluenceSignals>;
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

  // NEW: Add influence note when multiplier > 1.05
  let influenceNote = '';
  if (args.influence_m && args.influence_m > 1.05 && args.influenceSignals) {
    const signals = args.influenceSignals;
    const details: string[] = [];
    if (signals.awards > 0) details.push('awards');
    if (signals.downloads_tier > 0) details.push(`${signals.downloads_tier >= 3 ? '10M+' : signals.downloads_tier >= 2 ? '5M+' : '1M+'} downloads`);
    if (signals.top_guests > 0) details.push('top guests');
    if (signals.longevity) details.push(`${details.length > 0 ? '' : ''}consistent ${details.length > 0 ? '' : 'track record'}`);
    
    if (details.length > 0) {
      influenceNote = ` High-authority show (${details.join(', ')}) increases impact despite broad positioning.`;
    }
  }

  return `Verdict: ${verdictWord} for ${args.clientName}. Audience: ${audienceClaim} and why that matters to the campaign. Content focus: ${themes} mapped to the client's talking points. Why it aligns: ${align} Gaps to note: ${gapsText}. ${risksText}${influenceNote} Next step: ${next}`;
}

// ---------------- HTTP handler ----------------
serve(async (req) => {
  // Log API key status immediately on function invocation
  console.log('[ANALYZE v2.0] Edge function invoked');
  console.log('[ANALYZE v2.0] OPENAI_API_KEY present:', !!OPENAI_API_KEY);
  console.log('[ANALYZE v2.0] OPENAI_API_KEY length:', OPENAI_API_KEY?.length || 0);
  console.log('[ANALYZE v2.0] OPENAI_API_KEY first 10 chars:', OPENAI_API_KEY?.substring(0, 10) || 'undefined');
  
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
      console.error('[ANALYZE v2.0] ❌ Missing or empty OPENAI_API_KEY - falling back to heuristic scorer');
      console.error('[ANALYZE v2.0] Environment variable status:', {
        isDefined: OPENAI_API_KEY !== undefined,
        isNull: OPENAI_API_KEY === null,
        isEmpty: OPENAI_API_KEY === '',
        type: typeof OPENAI_API_KEY
      });
      const notesForFallback = String(show_notes || "");
      let consumerCuesForFallback: string[] = [];
      try {
        consumerCuesForFallback = detectConsumerCues(notesForFallback);
      } catch (e) {
        console.error('[ANALYZE v2.0] ERROR detecting consumer cues for fallback:', e);
      }
      const data = await scoreGoalCentric(client, notesForFallback, consumerCuesForFallback);
      data.fallback_reason = "Missing OPENAI_API_KEY environment variable";
      return new Response(JSON.stringify({ success: false, error: "missing_api_key", fallback_data: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    console.log('[ANALYZE v2.0] ✅ OPENAI_API_KEY validated - proceeding with OpenAI API call');

    // Detect consumer cues early (needed by both OpenAI and fallback paths)
    const notesForAnalysis = String(show_notes || "");
    let consumerCues: string[] = [];
    try {
      consumerCues = detectConsumerCues(notesForAnalysis);
      console.log('[ANALYZE v2.0] Consumer cues detected early:', consumerCues.length);
    } catch (e) {
      console.error('[ANALYZE v2.0] ERROR detecting consumer cues early:', e);
    }

    // Build audience-first prompt with NEW weights
    const prompt = `You will analyze podcast episode content against client campaign fit using this audience-first scoring rubric:

  **Scoring dimensions (apply independently, then aggregate):**

  1. **Topic relevance** (Weight: 0.45): How well the episode content aligns with the client's talking points, business focus, and target themes. Score 0-10.

  2. **ICP alignment** (Weight: 0.45): How well the podcast audience matches the client's target customer profile and decision-makers. Score 0-10.
     - **IMPORTANT**: If audience is "security pros/practitioners" AND content includes enterprise-grade themes (breaches, identity, ransomware, zero trust, cloud security, SOC, risk, compliance), treat as 7.5-8.5 ICP even without explicit "CISO" or "decision maker" mentions.
     - Only penalize ICP when audience is consumer/entry-level or purely hobbyist.

  3. **Brand suitability** (Weight: 0.10): How appropriate the podcast's editorial standards, tone, and content are for the client's brand positioning. Score 0-10.
     - **IMPORTANT**: Humor or informal tone should NOT reduce Brand Suitability unless client notes explicitly require "formal only" or "enterprise-only tone."
     - For security clients without "formal only" constraint, clamp Brand Suitability to ≥7.5 when content is accurate, ethical, and professional despite humor.

  4. **Format/CTA notes** (Weight: 0.00 - info only): Note episode format and CTA compatibility. This does NOT affect the score. Only raise risk flags for: pay-to-play, guest fees, link-ban policies, hard sales pitch format.

  **Aggregation rules (apply AFTER calculating baseline from weighted dimensions):**
  - If min(Topic, ICP) ≤ 4 → cap overall_score ≤ 5.5 (verdict: Not recommended)
  - If Topic ≥ 8 AND ICP ≥ 8 → ensure overall_score ≥ 7.5 unless Brand ≤ 5 (then apply -0.5 to -1.0)
  - If Topic ≥ 8.0 AND ICP ≥ 7.0 AND Brand ≥ 7.0 → ensure overall_score ≥ 7.5 (Near-strong floor)
  - If Brand ≤ 4 → cap overall_score ≤ 6.0 (maximum Consider)
  - If |Topic − ICP| ≥ 3.5 → overall_score -= 0.25 and add insight tag: "High concept / weaker audience match" or "Audience present / weak topical depth"

  **Guest eligibility (NOT a scored dimension):**
  - Analyze guest requirements separately (exclusive/effective/preferential/none)
  - The system will apply an eligibility gate AFTER your baseline score:
    * exclusive/effective + confirmed mismatch → cap final to 3.0
    * exclusive/effective + unknown eligibility → cap final to 6.0
    * preferential/none → no score impact

  **Verdict mapping:**
  - Recommend: overall_score ≥ 7.5 AND no red risk flags
  - Consider: 6.0–7.4 OR conditional eligibility
  - Not recommended: < 6.0 OR blocked by eligibility gate

    **Client context:**
    - Name: ${client.name || 'Unknown'}
    - Company: ${client.company || 'Not specified'}
    - Gender: ${client.gender || 'unspecified'}
    - Identity tags: ${(client.guest_identity_tags || []).join(', ') || 'None specified'}
    - Target audiences: ${(client.target_audiences || []).join(', ') || 'None specified'}
    - Talking points: ${(client.talking_points || []).join(', ') || 'None specified'}
    - Avoid topics: ${(client.avoid || []).join(', ') || 'None specified'}
    - Campaign notes: ${client.notes || 'None'}
    - Media kit URL: ${client.media_kit_url || 'Not provided'}
    
    **Episode content to analyze:**
    ${show_notes}
    
    **Policy: Only infer gender from explicit client.gender or high-confidence pronoun/name analysis.**
    **Do not infer ethnicity, religion, or political alignment unless explicitly stated in client identity tags.**
    
    **Influence signals (extract for confidence_note):**
    When scoring, note any high-authority signals you observe:
    - Awards/wins or repeated shortlistings (e.g., "best cybersecurity podcast")
    - Download scale mentions (1M+, 5M+, 10M+ lifetime downloads)
    - Guest caliber (recognized industry leaders like Mikko Hyppönen, Garry Kasparov, Jack Rhysider, Bruce Schneier, Katie Moussouris, Troy Hunt, etc.)
    - Longevity (≥3 years) with consistent weekly/regular publishing cadence
    - Chart rankings or press mentions (Apple Charts, TechCrunch, Wired, Forbes, etc.)
    
    **Note**: The system will apply an influence multiplier post-scoring based on these signals. Include them in your confidence_note for transparency.

    **Risk flags to evaluate (focus on strategic fit, not just mechanical issues):**
    - **RED (dealbreakers)**: Pay-to-play/guest fees, link/UTM bans, no guest submissions, confirmed eligibility mismatch, polarizing/controversial content that creates brand risk
    - **AMBER (strategic concerns requiring mitigation)**: 
      * Content format mismatches (narrative-heavy vs tactical needs, expertise level gaps)
      * Audience sophistication mismatches (consumer-focused vs enterprise target, junior vs senior)
      * Production/brand tone concerns (casual/raw vs professional brand)
      * Content recency issues (outdated frameworks/tech references)
      * Pitch strategy friction (warm intro preference, form-only contact)
      * Publishing irregularity or mixed enterprise/consumer signals
    - **GREEN (positive signals)**: Guest intake process available, direct contact email, active recent publishing, diverse guest perspectives, established audience engagement
    
    **For each risk flag, provide:**
    - Specific evidence (quote from episode or observation)
    - Clear mitigation strategy (actionable next step)
    - Focus on strategic fit concerns that affect campaign success

    Your response must be valid JSON with this exact structure:
    {
      "overall_score": <number 0-10 after applying aggregation rules>,
      "rubric_breakdown": [
        {"dimension": "Topic relevance", "weight": 0.45, "raw_score": <0-10>, "notes": "<brief explanation>"},
        {"dimension": "ICP alignment", "weight": 0.45, "raw_score": <0-10>, "notes": "<brief explanation>"},
        {"dimension": "Brand suitability", "weight": 0.10, "raw_score": <0-10>, "notes": "<brief explanation>"},
        {"dimension": "Format/CTA notes", "weight": 0, "raw_score": <0-10>, "notes": "<format observations, CTA compatibility - info only>"}
      ],
      "verdict": "recommend|consider|not_recommended",
      "verdict_reason": "<one sentence>",
      "why_fit_structured": [{"claim": "<claim>", "evidence": "<quote>", "interpretation": "<explanation>"}],
      "why_not_fit_structured": [{"severity": "Critical|Major|Minor", "claim": "<claim>", "evidence": "<quote>", "interpretation": "<explanation>"}],
      "risk_flags_structured": [
        {
          "severity": "Red|Amber|Green",
          "flag": "<specific concern or positive signal>",
          "evidence": "<quote or observation from episode>",
          "mitigation": "<actionable next step>"
        }
      ],
      "recommended_talking_points": ["<point1>", "<point2>", "<point3>"],
      "citations": ["<quote1>", "<quote2>"],
      "confidence": <0-1>,
      "confidence_label": "High|Med|Low",
      "confidence_note": "<explanation>",
      "what_would_change": ["<condition1>", "<condition2>"],
      "summary_text": "<140-200 words>"
    }`;

    const body = {
      model: "gpt-4o-mini",
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
        const data = await scoreGoalCentric(client, String(show_notes || ""), consumerCues);
        data.fallback_reason = `OpenAI API error: ${errMsg}`;
        const errorType = resp.status === 429 ? "rate_limit" : "api_error";
        return new Response(JSON.stringify({ success: false, error: errorType, fallback_data: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        const fb = await scoreGoalCentric(client, String(show_notes || ""), consumerCues);
        fb.fallback_reason = "LLM returned invalid JSON";
        return new Response(JSON.stringify({ success: false, error: "invalid_json", fallback_data: fb }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Post-process AI result: enforce caps/floors, attach adjustments, ensure summary consistency
      const notesText = String(show_notes || "");
      const expanded = expandConcepts(client);
      const conceptHitsCount = findPositions(notesText, expanded.strong).length + findPositions(notesText, expanded.near).length;
      const conceptOverlap = conceptHitsCount > 0;
      const avoids: string[] = (client?.avoid || []) as string[];
      const avoidCounts = avoids.map(a => ({ a, c: count(notesText, [a]) })).sort((x,y)=>y.c - x.c);
      const strongAvoidCentral = avoidCounts[0]?.c >= 2;

      // Compute weighted mean from LLM rubric with NEW weights (4 dimensions only)
      const rb: any[] = Array.isArray(data?.rubric_breakdown) ? data.rubric_breakdown : [];
      let topicRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('topic'))?.raw_score) || 0);
      let icpRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('icp'))?.raw_score) || 0);
      const ctaRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('cta'))?.raw_score) || 0);
      const brandRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('brand'))?.raw_score) || 0);
      
      // Count enterprise cues for ICP lift (applied after applied_adjustments is declared)
      const enterpriseCueCount = countEnterpriseCues(notesText);
      
      // Update ICP score in rubric breakdown
      rb.forEach((r: any) => {
        if (String(r?.dimension || '').toLowerCase().includes('icp')) {
          r.raw_score = icpRaw;
        }
      });
      
      const weighted_mean = topicRaw*0.45 + icpRaw*0.45 + brandRaw*0.10;

      let adjusted = Number(data?.overall_score) || 0;
      const applied_adjustments: { type: 'cap'|'floor'|'penalty'|'bonus'; label: string; amount?: number }[] = [];

      // Apply enterprise cue lift to ICP (cap at 9.0)
      if (enterpriseCueCount >= 4) {
        icpRaw = Math.min(9.0, icpRaw + 1.0);
        applied_adjustments.push({ type: 'bonus', label: 'Enterprise cues (4+)', amount: 1.0 });
      } else if (enterpriseCueCount >= 2) {
        icpRaw = Math.min(9.0, icpRaw + 0.5);
        applied_adjustments.push({ type: 'bonus', label: 'Enterprise cues (2+)', amount: 0.5 });
      }

      // Cap tracking (apply at most one)
      let cap_applied = false;
      let cap_type: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'none' = 'none';
      let cap_evidence = '';
      let cap_reason: string | undefined;
      const tryCap = (type: typeof cap_type, evidence: string, capMax = 5.0) => {
        if (cap_applied) return;
        cap_applied = true; cap_type = type; cap_evidence = evidence || '';
        adjusted = Math.min(adjusted, capMax);
        applied_adjustments.push({ type: 'cap', label: `${type.replace(/_/g,' ')}`, amount: capMax });
        cap_reason = `${type.replace(/_/g,' ')} — "${evidence || 'evidence required'}"`;
      };

      const payToPlayMatch = notesText.match(/(sponsored by|paid placement|advertorial|pay\s*to\s*play|guest\s+fee|fee\s+for\s+interview)/i);
      const linkBanMatch = notesText.match(/(no\s+links|no\s+external\s+links|no\s+backlinks|do\s+not\s+include\s+links|don['']t\s+include\s+urls|no\s+urls|utm\s+not\s+allowed)/i);
      const enterpriseVibe = enterpriseCueCount >= 1;
      // consumerCues now declared earlier (line ~952) to avoid ReferenceError
      const b2cMismatch = consumerCues.length >= 2 && enterpriseCueCount === 0;
      const cryptoCue = /(crypto|bitcoin|blockchain|defi|web3|ethereum|nft|solana|token\b|altcoin)/i.test(notesText);
      const clientText = norm([
        client?.name,
        client?.company,
        ...(client?.target_audiences || []),
        ...(client?.talking_points || []),
        client?.notes,
        client?.campaign_strategy,
      ].filter(Boolean).join(' '));
      const isEducationClient = /(k-?12|education|edtech|teacher|classroom|school|students|district|principal|superintendent|curriculum|pedagogy|literacy|numeracy)/i.test(clientText);

      if (cryptoCue && isEducationClient) {
        if (!cap_applied) {
          cap_applied = true; cap_type = 'avoid'; cap_evidence = 'crypto domain content conflicts with education ICP';
          adjusted = Math.min(adjusted, 1.0);
          applied_adjustments.push({ type: 'cap', label: 'avoid', amount: 1.0 });
          cap_reason = 'avoid — "crypto domain conflict with education ICP"';
        }
      } else if (strongAvoidCentral) {
        tryCap('avoid', avoidCounts[0].a);
      } else if (payToPlayMatch) {
        tryCap('pay_to_play', payToPlayMatch[0]);
      } else if (linkBanMatch) {
        tryCap('link_ban', linkBanMatch[0]);
      } else if (b2cMismatch) {
        tryCap('b2c_mismatch', 'consumer-only cues without enterprise signals');
      } else if (!conceptOverlap && topicRaw <= 5.0) {
        tryCap('zero_overlap', 'No relevant terms detected', 2.0);
      }

      // Calibration invariants
      const criticalCap = cap_applied && (cap_type === 'avoid' || cap_type === 'pay_to_play' || cap_type === 'link_ban' || cap_type === 'b2c_mismatch' || cap_type === 'zero_overlap');
      if (!criticalCap && topicRaw >= 8 && icpRaw >= 7 && brandRaw >= 7) {
        adjusted = Math.max(adjusted, 7.0);
      }
      if (!criticalCap && adjusted < (weighted_mean - 2.0)) {
        adjusted = weighted_mean - 2.0;
      }

      // === AGGREGATION RULES (audience-first) ===
      const minTopicIcp = Math.min(topicRaw, icpRaw);
      const topicIcpGap = Math.abs(topicRaw - icpRaw);

      // Rule 1: If min(Topic, ICP) ≤ 4 → cap final ≤ 5.5
      if (minTopicIcp <= 4) {
        adjusted = Math.min(adjusted, 5.5);
        applied_adjustments.push({ 
          type: 'cap', 
          label: 'Weak topic or audience fit', 
          amount: 5.5 
        });
      }

      // Rule 2: If Topic ≥ 8 AND ICP ≥ 8 AND Brand ≤ 5 → apply penalty
      if (topicRaw >= 8 && icpRaw >= 8 && brandRaw <= 5) {
        const brandPenalty = brandRaw <= 4 ? -1.0 : -0.5;
        adjusted = Math.max(0, adjusted + brandPenalty);
        applied_adjustments.push({ 
          type: 'penalty', 
          label: 'Brand quality concern', 
          amount: brandPenalty 
        });
      }
      // Rule 2b: If Topic ≥ 8 AND ICP ≥ 8 → ensure final ≥ 7.5 (unless brand killed it)
      else if (topicRaw >= 8 && icpRaw >= 8) {
        adjusted = Math.max(adjusted, 7.5);
        applied_adjustments.push({ 
          type: 'floor', 
          label: 'Strong topic + audience fit', 
          amount: 7.5 
        });
      }
      
      // Rule 2c: Near-Strong Floor - if Topic ≥ 8.0 AND ICP ≥ 7.0 AND Brand ≥ 7.0 AND no hard caps
      const hasHardCap = cap_applied && (cap_type === 'avoid' || cap_type === 'pay_to_play' || cap_type === 'link_ban' || cap_type === 'zero_overlap');
      if (topicRaw >= 8.0 && icpRaw >= 7.0 && brandRaw >= 7.0 && !hasHardCap) {
        adjusted = Math.max(adjusted, 7.5);
        applied_adjustments.push({ 
          type: 'floor', 
          label: 'Near-strong foundation (8/7/7)', 
          amount: 7.5 
        });
      }

      // Rule 3: If Brand ≤ 4 → cap final ≤ 6.0
      if (brandRaw <= 4) {
        adjusted = Math.min(adjusted, 6.0);
        applied_adjustments.push({ 
          type: 'cap', 
          label: 'Brand suitability concern', 
          amount: 6.0 
        });
      }

      // Rule 4: If |Topic − ICP| ≥ 3.5 → apply -0.25 penalty (softened)
      if (topicIcpGap >= 3.5) {
        adjusted = Math.max(0, adjusted - 0.25);
        const gapType = topicRaw > icpRaw 
          ? 'High concept / weaker audience match' 
          : 'Audience present / weak topical depth';
        applied_adjustments.push({ 
          type: 'penalty', 
          label: gapType, 
          amount: -0.25 
        });
      }

      // Apply final clamp
      adjusted = clamp(adjusted, 0, 10);

      // Store baseline before eligibility gate
      const baseline_overall = adjusted;

      // Detect guest requirements from show notes
      const guestRequirements = detectGuestRequirements(notesText);

      // Enrich client data for eligibility scoring
      const clientEnrichment = await enrichClientData(client.media_kit_url);

      // Score eligibility if requirements exist
      let eligibilityResult = { eligible: true, confidence: 'none' as const, reasoning: 'No requirements detected' };
      if (guestRequirements.class !== 'none') {
        eligibilityResult = scoreGuestEligibility(client, clientEnrichment, guestRequirements);
      }

      // Apply eligibility gate
      const gateResult = applyEligibilityGate(
        baseline_overall,
        guestRequirements,
        eligibilityResult,
        client
      );

      // Use gated score as final
      adjusted = gateResult.final_overall;
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

      // Update rubric breakdown with correct weights
      rb.forEach((r: any) => {
        if (String(r?.dimension || '').toLowerCase().includes('topic')) r.weight = 0.45;
        else if (String(r?.dimension || '').toLowerCase().includes('icp')) r.weight = 0.45;
        else if (String(r?.dimension || '').toLowerCase().includes('brand')) r.weight = 0.10;
        else if (String(r?.dimension || '').toLowerCase().includes('cta') || String(r?.dimension || '').toLowerCase().includes('format')) r.weight = 0;
      });

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
          baseline_overall,
          final_overall: adjusted,
          weighted_mean,
          adjustments: { genericness: 0, multi_concept: 0, cadence: 0 },
          cap_applied,
          cap_type,
          cap_evidence,
          enterprise_cues_count: enterpriseCueCount,
          eligibility: gateResult.gate,
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
      const data = await scoreGoalCentric(client, String(show_notes || ""));
      const errorMsg = (e as any)?.message || 'LLM call failed';
      data.fallback_reason = errorMsg;
      const errorType = errorMsg.includes('aborted') || errorMsg.includes('timeout') ? "timeout" : "network_error";
      return new Response(JSON.stringify({ success: false, error: errorType, fallback_data: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (_e) {
    console.error('Analyze function error:', _e);
    const errorMessage = (_e as Error).message || 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: `Analyze error: ${errorMessage}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});