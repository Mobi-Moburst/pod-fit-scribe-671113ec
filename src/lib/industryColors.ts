// Subtle pill colors keyed by industry category.
// Uses HSL with low saturation backgrounds + readable foregrounds that work in dark mode.
const PALETTE: Record<string, { bg: string; fg: string; ring: string }> = {
  "AI Productivity":   { bg: "hsl(265 50% 55% / 0.12)", fg: "hsl(265 70% 80%)", ring: "hsl(265 50% 55% / 0.25)" },
  "Enterprise AI":     { bg: "hsl(250 55% 55% / 0.12)", fg: "hsl(250 70% 82%)", ring: "hsl(250 55% 55% / 0.25)" },
  "Data & AI":         { bg: "hsl(220 60% 55% / 0.12)", fg: "hsl(220 75% 80%)", ring: "hsl(220 60% 55% / 0.25)" },
  "Cybersecurity":     { bg: "hsl(0 55% 50% / 0.12)",   fg: "hsl(0 70% 78%)",   ring: "hsl(0 55% 50% / 0.25)" },
  "Fintech":           { bg: "hsl(150 50% 45% / 0.14)", fg: "hsl(150 60% 75%)", ring: "hsl(150 50% 45% / 0.25)" },
  "Healthcare":        { bg: "hsl(190 55% 45% / 0.14)", fg: "hsl(190 70% 78%)", ring: "hsl(190 55% 45% / 0.25)" },
  "HealthTech":        { bg: "hsl(180 55% 45% / 0.14)", fg: "hsl(180 70% 78%)", ring: "hsl(180 55% 45% / 0.25)" },
  "Education":         { bg: "hsl(35 75% 55% / 0.14)",  fg: "hsl(35 80% 75%)",  ring: "hsl(35 75% 55% / 0.25)" },
  "EdTech":            { bg: "hsl(45 75% 55% / 0.14)",  fg: "hsl(45 80% 75%)",  ring: "hsl(45 75% 55% / 0.25)" },
  "SaaS":              { bg: "hsl(210 50% 55% / 0.12)", fg: "hsl(210 70% 80%)", ring: "hsl(210 50% 55% / 0.25)" },
  "DevTools":          { bg: "hsl(280 50% 55% / 0.12)", fg: "hsl(280 65% 80%)", ring: "hsl(280 50% 55% / 0.25)" },
  "Marketing & Growth":{ bg: "hsl(320 55% 55% / 0.12)", fg: "hsl(320 70% 80%)", ring: "hsl(320 55% 55% / 0.25)" },
  "Sales & RevOps":    { bg: "hsl(340 55% 55% / 0.12)", fg: "hsl(340 70% 80%)", ring: "hsl(340 55% 55% / 0.25)" },
  "HR & People":       { bg: "hsl(15 65% 55% / 0.12)",  fg: "hsl(15 75% 80%)",  ring: "hsl(15 65% 55% / 0.25)" },
  "E-commerce":        { bg: "hsl(25 70% 55% / 0.14)",  fg: "hsl(25 80% 78%)",  ring: "hsl(25 70% 55% / 0.25)" },
  "Consumer":          { bg: "hsl(340 60% 60% / 0.12)", fg: "hsl(340 70% 80%)", ring: "hsl(340 60% 60% / 0.25)" },
  "Media & Content":   { bg: "hsl(295 50% 55% / 0.12)", fg: "hsl(295 65% 80%)", ring: "hsl(295 50% 55% / 0.25)" },
  "Real Estate":       { bg: "hsl(100 40% 45% / 0.14)", fg: "hsl(100 55% 75%)", ring: "hsl(100 40% 45% / 0.25)" },
  "Legal":             { bg: "hsl(225 35% 50% / 0.14)", fg: "hsl(225 55% 78%)", ring: "hsl(225 35% 50% / 0.25)" },
  "Climate & Energy":  { bg: "hsl(135 50% 45% / 0.14)", fg: "hsl(135 60% 75%)", ring: "hsl(135 50% 45% / 0.25)" },
  "Manufacturing":     { bg: "hsl(20 30% 50% / 0.14)",  fg: "hsl(20 45% 78%)",  ring: "hsl(20 30% 50% / 0.25)" },
  "Logistics":         { bg: "hsl(200 45% 45% / 0.14)", fg: "hsl(200 60% 78%)", ring: "hsl(200 45% 45% / 0.25)" },
  "Consulting":        { bg: "hsl(240 30% 55% / 0.14)", fg: "hsl(240 50% 80%)", ring: "hsl(240 30% 55% / 0.25)" },
  "Venture Capital":   { bg: "hsl(160 45% 45% / 0.14)", fg: "hsl(160 60% 78%)", ring: "hsl(160 45% 45% / 0.25)" },
  "Nonprofit":         { bg: "hsl(170 45% 45% / 0.14)", fg: "hsl(170 60% 78%)", ring: "hsl(170 45% 45% / 0.25)" },
  "Other":             { bg: "hsl(0 0% 60% / 0.12)",    fg: "hsl(0 0% 80%)",    ring: "hsl(0 0% 60% / 0.25)" },
};

export function industryStyle(industry?: string | null): { bg: string; fg: string; ring: string } {
  if (!industry) return PALETTE["Other"];
  if (PALETTE[industry]) return PALETTE[industry];
  // Stable hash fallback for unknown labels
  let h = 0;
  for (let i = 0; i < industry.length; i++) h = (h * 31 + industry.charCodeAt(i)) % 360;
  return { bg: `hsl(${h} 50% 50% / 0.12)`, fg: `hsl(${h} 65% 80%)`, ring: `hsl(${h} 50% 50% / 0.25)` };
}
