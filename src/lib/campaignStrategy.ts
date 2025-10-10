// Utilities to parse and build a unified campaign strategy text
// Extracts Target Audiences and Talking Points sections from freeform text

// Ignore common intro sentences coworkers may paste into strategies
const isIntroLine = (s: string) => {
  const t = String(s || "").trim().replace(/^["']|["']$/g, "").replace(/\r/g, "");
  const lower = t.toLowerCase().replace(/’/g, "'");
  return /^we'll be pitching you to podcasts that reach these key audiences:?\s*$/.test(lower)
    || /^every show is different,? but we'll position you around these core themes:?\s*$/.test(lower);
};

export function parseCampaignStrategy(text: string): { audiences: string[]; talking: string[] } {
  const t = (text || "").replace(/\r/g, "");
  const lines = t.split("\n");
  const audiences: string[] = [];
  const talking: string[] = [];

  let mode: "aud" | "talk" | null = null;
  const isAudHdr = (s: string) => /^(\s)*(target\s*audiences?|audience|icp)\s*:?\s*$/i.test(s);
  const isTalkHdr = (s: string) => /^(talking\s*points|topics\s*to\s*prioritize|key\s*topics|messaging\s*pillars)\s*:?\s*$/i.test(s);
  const isHdr = (s: string) => isAudHdr(s) || isTalkHdr(s);
  
  const add = (arr: string[], raw: string) => {
    const s = String(raw || "").trim().replace(/^[-*•]\s*/, "");
    if (!s) return;
    
    let part = s;
    
    // First try colon separator (most common in new format)
    const colonMatch = s.split(/\s*:\s*/, 2)[0]?.trim();
    if (colonMatch && colonMatch.length < s.length) {
      part = colonMatch;
    } else {
      // Then try dash separator (existing logic)
      const dashMatch = s.split(/\s[–—–-]\s/, 2)[0]?.trim();
      if (dashMatch && dashMatch.length < s.length) {
        part = dashMatch;
      }
    }
    
    // Additional cleanup: remove trailing parentheticals if they remain
    part = part.replace(/\s*\([^)]*\)\s*$/, '').trim();
    
    if (!part) return;
    if (!arr.some((x) => x.toLowerCase() === part.toLowerCase())) arr.push(part);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isHdr(line)) {
      mode = isAudHdr(line) ? "aud" : "talk";
      continue;
    }
    if (!mode) continue;
    if (isIntroLine(line)) continue;
    add(mode === "aud" ? audiences : talking, line);
  }

  return { audiences, talking };
}

export function buildCampaignStrategyFromArrays(audiences: string[] = [], talking: string[] = []): string {
  const aud = (audiences || []).filter(Boolean);
  const tp = (talking || []).filter(Boolean);
  const parts: string[] = [];
  if (aud.length) {
    parts.push("Target Audiences:\n" + aud.map((a) => `- ${a}`).join("\n"));
  }
  if (tp.length) {
    parts.push("Talking Points That Will Land:\n" + tp.map((t) => `- ${t}`).join("\n"));
  }
  return parts.join("\n\n");
}

// Select the top N concise, high-signal audience tags from campaign strategy and/or provided audiences
export function pickTopAudienceTags(opts: {
  strategyText?: string;
  audiences?: string[];
  max?: number;
}): string[] {
  const max = Math.max(1, Math.min(10, opts?.max ?? 3));
  const provided = Array.isArray(opts?.audiences) ? opts!.audiences! : [];
  const strategy = (opts?.strategyText || '').replace(/\r/g, '');

  // Parse strategy to get structured sections
  let parsedAud: string[] = [];
  let parsedTalk: string[] = [];
  try {
    const parsed = parseCampaignStrategy(strategy);
    parsedAud = parsed.audiences || [];
    parsedTalk = parsed.talking || [];
  } catch {
    // ignore parse errors and proceed with provided audiences
  }

  const rawCandidates = [...provided, ...parsedAud];
  const talkingSet = new Set(parsedTalk.map((t) => t.toLowerCase().trim()));

  const clean = (s: string) =>
    String(s || '')
      .trim()
      .replace(/^[-*•]\s*/, '') // bullets
      .replace(/\s*:\s*.*/, '') // keep left side of colon
      .replace(/\s[–—-]\s.*/, '') // keep left side of dash
      .replace(/\s*\([^)]*\)\s*$/, '') // remove trailing parentheticals
      .replace(/\s+/g, ' ')
      .replace(/^\s*:\s*$/, '')
      .trim();

  const isHeaderLike = (s: string) => isIntroLine(s) || /^(target\s*audiences?|audience|icp|talking\s*points|topics\s*to\s*prioritize|key\s*topics|messaging\s*pillars)\s*:?\s*$/i.test(s);

  // Unique by lowercase text while preserving first occurrence
  const seen = new Set<string>();
  const candidates: { text: string; i: number }[] = [];
  rawCandidates.forEach((raw, idx) => {
    const t = clean(raw);
    if (!t) return;
    if (isHeaderLike(t)) return;
    if (talkingSet.has(t.toLowerCase())) return; // exclude explicit talking points
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ text: t, i: idx });
  });

  if (!candidates.length) return [];

  const audienceKeywords = [
    'founder','founders','startup','entrepreneur','executive','c-suite','cto','cio','ciso','ceo','cfo','coo','vp','director',
    'engineer','developer','dev','product','pm','designer','data','ml','ai','ops','security','marketing','marketer','growth',
    'sales','seller','account','customer success','success','revops','hr','recruit','finance','procurement','it','sre',
    'b2b','b2c','smb','mid-market','enterprise','agency','consultant','freelancer','founding','operator','owner',
    'educator','teacher','student','creator','influencer','investor','vc','angel'
  ];
  const kwRegex = new RegExp(`\\b(${audienceKeywords.join('|')})\\b`, 'i');

  const score = (txt: string, index: number) => {
    const len = txt.length;
    const words = txt.split(/\s+/).filter(Boolean).length;
    // Conciseness: prefer 2-6 words
    let conciseness = 0;
    if (words <= 2) conciseness = 0.9;
    else if (words <= 4) conciseness = 1.0;
    else if (words <= 6) conciseness = 0.9;
    else if (words <= 10) conciseness = 0.6;
    else conciseness = 0.3;

    // Keyword boost if contains audience-y words
    const kwBoost = kwRegex.test(txt) ? 0.5 : 0;

    // Position weight (earlier is better)
    const pos = 1 / (1 + index);

    // Penalize extremely long strings
    const lengthPenalty = len > 80 ? -0.3 : len > 120 ? -0.6 : 0;

    return conciseness + kwBoost + pos + lengthPenalty;
  };

  const ranked = candidates
    .map((c) => ({ ...c, s: score(c.text, c.i) }))
    .sort((a, b) => (b.s - a.s) || (a.text.length - b.text.length) || (a.i - b.i));

  return ranked.slice(0, max).map((r) => r.text);
}
