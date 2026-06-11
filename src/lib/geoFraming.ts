// Reframes the AEO/GEO audit numbers as achievement-led intelligence,
// not a naked "55/100" scorecard. Same data, repositioned.

import type { ReportData } from "@/types/reports";

export type GEOTier = {
  label: string; // e.g. "Established Voice"
  description: string; // one-line explanation
  rank: 1 | 2 | 3 | 4; // for visual emphasis
};

export type GEOFraming = {
  tier: GEOTier;
  headline: string; // the new lead sentence
  achievements: string[]; // 2-4 concrete wins
  enginesTested: string[]; // raw list, used to decide if we surface engine framing
  showEngineFraming: boolean; // false when only 1 engine tested
  buyerQuestionCount: number;
  authorityDomainCount: number;
  uniformPromptCounts: boolean; // true when every prompt count is 1 (hide the column)
  primaryEngineLabel: string | null; // "Claude" / "ChatGPT" / etc. for single-engine reports
};

const ENGINE_LABELS: Record<string, string> = {
  claude: "Claude",
  anthropic: "Claude",
  openai: "ChatGPT",
  chatgpt: "ChatGPT",
  gpt: "ChatGPT",
  gemini: "Gemini",
  google: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  xai: "Grok",
};

function prettyEngine(name: string): string {
  const k = name.toLowerCase().trim();
  return ENGINE_LABELS[k] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

function deriveTier(buyerQuestions: number, authorityDomains: number): GEOTier {
  const score = buyerQuestions + authorityDomains * 2; // weight topic breadth slightly higher
  if (score >= 30) {
    return {
      label: "Category Leader",
      description: "Dominant AI presence across your buyer's decision journey",
      rank: 4,
    };
  }
  if (score >= 18) {
    return {
      label: "Established Voice",
      description: "AI assistants consistently surface you for high-intent buyer questions",
      rank: 3,
    };
  }
  if (score >= 8) {
    return {
      label: "Emerging Authority",
      description: "Building meaningful AI visibility with room to expand topic depth",
      rank: 2,
    };
  }
  return {
    label: "Foundational Presence",
    description: "Initial AI footprint established — early-stage visibility",
    rank: 1,
  };
}

export function getGEOFraming(
  geo: NonNullable<ReportData["geo_analysis"]> | null | undefined,
  speakerName?: string,
): GEOFraming | null {
  if (!geo) return null;

  const buyerQuestionCount = geo.top_prompts?.length ?? 0;
  const authorityDomainCount = geo.topic_distribution?.length ?? 0;
  const enginesTested = (geo.unique_ai_engines ?? []).map(prettyEngine);
  const showEngineFraming = enginesTested.length > 1;
  const primaryEngineLabel = enginesTested.length === 1 ? enginesTested[0] : null;
  const uniformPromptCounts =
    buyerQuestionCount > 0 &&
    (geo.top_prompts ?? []).every((p) => (p.count ?? 0) <= 1);

  const tier = deriveTier(buyerQuestionCount, authorityDomainCount);

  const subject = speakerName ?? "This campaign";
  const headline = primaryEngineLabel
    ? `${subject} surfaces in ${primaryEngineLabel} for ${buyerQuestionCount} high-intent buyer question${
        buyerQuestionCount === 1 ? "" : "s"
      } across ${authorityDomainCount} authority domain${authorityDomainCount === 1 ? "" : "s"}.`
    : `${subject} surfaces across ${enginesTested.length} AI assistants for ${buyerQuestionCount} high-intent buyer questions.`;

  const achievements: string[] = [];
  if (buyerQuestionCount > 0) {
    achievements.push(
      `Discovered through **${buyerQuestionCount}** distinct buyer-intent quer${
        buyerQuestionCount === 1 ? "y" : "ies"
      }`,
    );
  }
  if (authorityDomainCount > 0) {
    const top = geo.topic_distribution?.[0]?.topic;
    achievements.push(
      `Positioned as an authority across **${authorityDomainCount}** strategic topic${
        authorityDomainCount === 1 ? "" : "s"
      }${top ? ` — anchored in **${top}**` : ""}`,
    );
  }
  if (primaryEngineLabel) {
    achievements.push(
      `Tested against **${primaryEngineLabel}** — the AI assistant trusted for nuanced, high-stakes business research`,
    );
  } else if (enginesTested.length > 1) {
    achievements.push(
      `Indexed across **${enginesTested.length}** leading AI assistants (${enginesTested.join(", ")})`,
    );
  }

  return {
    tier,
    headline,
    achievements,
    enginesTested,
    showEngineFraming,
    buyerQuestionCount,
    authorityDomainCount,
    uniformPromptCounts,
    primaryEngineLabel,
  };
}

// Compact subtitle for KPI cards on the dashboard / public report.
export function getGEOCardSubtitle(framing: GEOFraming | null): string {
  if (!framing) return "AI visibility intelligence";
  const parts: string[] = [];
  if (framing.buyerQuestionCount > 0) {
    parts.push(`${framing.buyerQuestionCount} buyer question${framing.buyerQuestionCount === 1 ? "" : "s"}`);
  }
  if (framing.authorityDomainCount > 0) {
    parts.push(`${framing.authorityDomainCount} authority domain${framing.authorityDomainCount === 1 ? "" : "s"}`);
  }
  return parts.length ? parts.join(" • ") + " • Click for details" : framing.tier.description;
}
