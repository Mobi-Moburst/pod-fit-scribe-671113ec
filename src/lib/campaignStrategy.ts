// Utilities to parse and build a unified campaign strategy text
// Extracts Target Audiences and Talking Points sections from freeform text

export function parseCampaignStrategy(text: string): { audiences: string[]; talking: string[] } {
  const t = (text || "").replace(/\r/g, "");
  const lines = t.split("\n");
  const audiences: string[] = [];
  const talking: string[] = [];

  let mode: "aud" | "talk" | null = null;
  const isAudHdr = (s: string) => /^(\s)*(target\s*audiences?|audience|icp)\s*:/i.test(s);
  const isTalkHdr = (s: string) => /(talking\s*points|topics\s*to\s*prioritize|key\s*topics|messaging\s*pillars)\s*:/i.test(s);
  const isHdr = (s: string) => isAudHdr(s) || isTalkHdr(s);

  const add = (arr: string[], raw: string) => {
    const s = String(raw || "").trim().replace(/^[-*•]\s*/, "");
    if (!s) return;
    // If formatted as "X – Y", keep the concise left side as the tag
    const part = s.split(/\s[–—–]\s/, 2)[0]?.trim() || s;
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
