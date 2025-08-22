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
    { pattern: /\b(christian entrepreneurs|faith-based business|ministry leaders)\b/i, type: 'identity', evidence: 'christian focus' },
    { pattern: /\b(primarily women|mostly female|focus on women)\b/i, type: 'gender', evidence: 'women preference' },
    { pattern: /\b(startup founders|entrepreneur guests|founder interviews)\b/i, type: 'role', evidence: 'founder preference' },
    { pattern: /\b(published authors|bestselling authors|book writers)\b/i, type: 'professional', evidence: 'author preference' },
  ];
  
  // Check exclusive patterns first
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
  let score = 7.0; // Default neutral
  
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

// ---------------- Heuristic Scorer (Goal-centric) ----------------
async function scoreGoalCentric(client: any, show_notes: string) {
  const notes: string = String(show_notes || "");
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
  
  // Score guest eligibility
  const eligibilityResult = scoreGuestEligibility(clientEnrichment, guestRequirements);

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
  const topicRelevance = roundToHalf(clamp(2 + weightedConceptScore * 0.5));

  // ICP alignment (0.25)
  const audStrong = findPositions(notes, audiences.map(norm)).length;
  const audAdj = nearHits.filter(h => audiences.some(a => norm(h.term).includes(norm(a)))).length;
  const icpAlignment = roundToHalf(clamp(2 + Math.min(7, audStrong * 2 + Math.min(2, audAdj * 0.5))));

  // Guest eligibility (0.20)
  const guestEligibility = eligibilityResult.score;

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

  // Weighted mean with new 5-dimension structure
  const weights = { topic: 0.30, icp: 0.25, eligibility: 0.20, cta: 0.15, brand: 0.10 } as const;
  const weighted_mean = topicRelevance * weights.topic + icpAlignment * weights.icp + guestEligibility * weights.eligibility + ctaSynergy * weights.cta + brandSuitability * weights.brand;

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
  const linkBanMatch = notes.match(/(no\s+links|do\s+not\s+include\s+links|don['']t\s+include\s+urls|no\s+urls)/i);
  const consumerCue = /(giveaway|coupon|subscribe and save|lifestyle|beauty|fashion|fitness|cooking|parenting|celebrity|gossip)/i.test(notes);
  const b2cMismatch = consumerCue && !enterpriseVibe;

  let cap_applied = false;
  let cap_type: 'zero_overlap' | 'avoid' | 'pay_to_play' | 'link_ban' | 'b2c_mismatch' | 'none' = 'none';
  let cap_evidence = '';
  let cap_reason: string | undefined;

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
    const avoidA = avoidCounts[0]?.a;
    const claim = avoidA ? `Contains avoid term: "${avoidA}"` : 'Critical conflict with avoid criteria';
    const evidence = cap_evidence || avoidA || 'domain conflict';
    why_not_fit_structured.push({ severity: 'Critical', claim, evidence, interpretation: 'Central to episode; brand/scope conflict' });
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

  // Add eligibility-specific feedback
  if (guestRequirements.class === 'exclusive' && !eligibilityResult.eligible) {
    why_not_fit_structured.push({ 
      severity: 'Critical', 
      claim: `Guest eligibility mismatch: ${guestRequirements.evidence}`, 
      evidence: eligibilityResult.reasoning, 
      interpretation: 'Client does not meet show\'s guest requirements' 
    });
  }

  // Risk flags
  const risk_flags_structured: { severity: 'Critical' | 'Major' | 'Minor'; flag: string; mitigation: string }[] = [];
  if (payToPlayMatch) risk_flags_structured.push({ severity: 'Major', flag: 'Pay-to-play indications', mitigation: 'Confirm editorial policy or negotiate earned placement' });
  if (strongAvoidCentral) risk_flags_structured.push({ severity: 'Critical', flag: `Avoid term prominent: ${avoidCounts[0].a}`, mitigation: 'Pick a different episode or angle; avoid brand conflict' });
  
  // Add eligibility risks
  if (guestRequirements.class === 'exclusive' && eligibilityResult.confidence === 'low') {
    risk_flags_structured.push({ 
      severity: 'Major', 
      flag: 'Guest eligibility unclear', 
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
    { dimension: "Guest eligibility", weight: weights.eligibility, raw_score: guestEligibility, notes: `${guestRequirements.class === 'none' ? 'No requirements' : guestRequirements.evidence} - ${eligibilityResult.reasoning}` },
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
    audit: {
      weighted_mean,
      adjustments: { genericness: adj_genericness, multi_concept: adj_multi_concept, cadence: adj_cadence },
      cap_applied,
      cap_type,
      cap_evidence,
    },
    // Guest eligibility details
    guest_requirements: guestRequirements,
    client_enrichment: clientEnrichment,
    eligibility_result: eligibilityResult,
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

  return `Verdict: ${verdictWord} for ${args.clientName}. Audience: ${audienceClaim} and why that matters to the campaign. Content focus: ${themes} mapped to the client's talking points. Why it aligns: ${align} Gaps to note: ${gapsText}. ${risksText} Next step: ${next}`;
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
      const data = await scoreGoalCentric(client, String(show_notes || ""));
      data.fallback_reason = "Missing OPENAI_API_KEY";
      return new Response(JSON.stringify({ success: false, error: "missing_api_key", fallback_data: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build goal-centric prompt with updated weights
    const prompt = `You will analyze podcast episode content against client campaign fit using this 5-dimension scoring rubric:

      1. **Topic relevance** (Weight: 0.30): How well the episode content aligns with the client's talking points, business focus, and target themes. Score 0-10.

      2. **ICP alignment** (Weight: 0.25): How well the podcast audience matches the client's target customer profile and decision-makers. Score 0-10.

      3. **Guest eligibility** (Weight: 0.20): How well the client matches any specific guest requirements detected in the show (gender, role, identity, professional background). Score 0-10.

      4. **CTA synergy** (Weight: 0.15): How compatible the episode format and tone are with the client's preferred call-to-action (demo, guide, consultation). Score 0-10.

      5. **Brand suitability** (Weight: 0.10): How appropriate the podcast's editorial standards, tone, and content are for the client's brand positioning. Score 0-10.

        **Client context:**
        - Name: ${client.name || 'Unknown'}
        - Company: ${client.company || 'Not specified'}  
        - Target audiences: ${(client.target_audiences || []).join(', ') || 'None specified'}
        - Talking points: ${(client.talking_points || []).join(', ') || 'None specified'}
        - Avoid topics: ${(client.avoid || []).join(', ') || 'None specified'}
        - Campaign notes: ${client.notes || 'None'}
        - Media kit URL: ${client.media_kit_url || 'Not provided'}
        
        **Episode content to analyze:**
        ${show_notes}
        
        **Guest eligibility analysis instructions:**
        - Look for specific guest requirements in the show notes (e.g., "women entrepreneurs only", "founders only", "veterans", "published authors")
        - Classify requirements as EXCLUSIVE (hard requirement), PREFERENTIAL (strong preference), or THEMATIC (general focus)
        - For guest eligibility scoring:
          * If no requirements detected: Score 7.0 (neutral)
          * If client matches exclusive requirement: Score 9-10
          * If client doesn't match exclusive requirement: Score 0-2
          * If client matches preferential requirement: Score 8-9
          * If client doesn't match preferential requirement: Score 4-5
          * If insufficient data to determine eligibility: Score 3-4 for exclusive, 6-7 for preferential

        Your response must be valid JSON with this exact structure:
        {
          "overall_score": <number 0-10>,
          "rubric_breakdown": [
            {"dimension": "Topic relevance", "weight": 0.30, "raw_score": <0-10>, "notes": "<brief explanation>"},
            {"dimension": "ICP alignment", "weight": 0.25, "raw_score": <0-10>, "notes": "<brief explanation>"},
            {"dimension": "Guest eligibility", "weight": 0.20, "raw_score": <0-10>, "notes": "<brief explanation>"},
            {"dimension": "CTA synergy", "weight": 0.15, "raw_score": <0-10>, "notes": "<brief explanation>"},
            {"dimension": "Brand suitability", "weight": 0.10, "raw_score": <0-10>, "notes": "<brief explanation>"}
          ],
          "verdict": "recommend|consider|not_recommended",
          "verdict_reason": "<one sentence>",
          "why_fit_structured": [{"claim": "<claim>", "evidence": "<quote>", "interpretation": "<explanation>"}],
          "why_not_fit_structured": [{"severity": "Critical|Major|Minor", "claim": "<claim>", "evidence": "<quote>", "interpretation": "<explanation>"}],
          "risk_flags_structured": [{"severity": "Critical|Major|Minor", "flag": "<flag>", "mitigation": "<action>"}],
          "recommended_talking_points": ["<point1>", "<point2>", "<point3>"],
          "citations": ["<quote1>", "<quote2>"],
          "confidence": <0-1>,
          "confidence_label": "High|Med|Low",
          "confidence_note": "<explanation>",
          "what_would_change": ["<condition1>", "<condition2>"],
          "summary_text": "<140-200 words>"
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
        const data = await scoreGoalCentric(client, String(show_notes || ""));
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
        const fb = await scoreGoalCentric(client, String(show_notes || ""));
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

      // Compute weighted mean from LLM rubric with updated weights
      const rb: any[] = Array.isArray(data?.rubric_breakdown) ? data.rubric_breakdown : [];
      const topicRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('topic'))?.raw_score) || 0);
      const icpRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('icp'))?.raw_score) || 0);
      const eligibilityRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('eligibility'))?.raw_score) || 0);
      const ctaRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('cta'))?.raw_score) || 0);
      const brandRaw = Number((rb.find((r: any) => String(r?.dimension || '').toLowerCase().includes('brand'))?.raw_score) || 0);
      const weighted_mean = topicRaw*0.30 + icpRaw*0.25 + eligibilityRaw*0.20 + ctaRaw*0.15 + brandRaw*0.10;

      let adjusted = Number(data?.overall_score) || 0;
      const applied_adjustments: { type: 'cap'|'floor'|'penalty'|'bonus'; label: string; amount?: number }[] = [];

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

      const payToPlayMatch = notesText.match(/(sponsored by|paid placement|advertorial|pay\s*to\s*play)/i);
      const linkBanMatch = notesText.match(/(no\s+links|do\s+not\s+include\s+links|don['']t\s+include\s+urls|no\s+urls)/i);
      const enterpriseVibe = /(enterprise|b2b|ciso|cio|governance|compliance|risk|security)/i.test(notesText);
      const consumerCue = /(giveaway|coupon|subscribe and save|lifestyle|beauty|fashion|fitness|cooking|parenting|celebrity|gossip)/i.test(notesText);
      const b2cMismatch = consumerCue && !enterpriseVibe;
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
      const data = await scoreGoalCentric(client, String(show_notes || ""));
      const errorMsg = (e as any)?.message || 'LLM call failed';
      data.fallback_reason = errorMsg;
      const errorType = errorMsg.includes('aborted') || errorMsg.includes('timeout') ? "timeout" : "network_error";
      return new Response(JSON.stringify({ success: false, error: errorType, fallback_data: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (_e) {
    return new Response(
      JSON.stringify({ success: false, error: "Analyze error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});