import { ReportData, PodcastReportEntry } from "@/types/reports";

export interface DemoClient {
  id: string;
  company: {
    name: string;
    logo_url: string;
    brand_colors?: { primary: string };
  };
  speaker: {
    name: string;
    title: string;
    talking_points: string[];
    target_audiences: string[];
    campaign_strategy: string;
  };
  reportData: ReportData;
}

// SignalForge AI Demo Data
const signalForgePodcasts: PodcastReportEntry[] = [
  {
    show_title: "Marketing School - Digital Marketing and Online Marketing Tips",
    episode_link: "https://podcasts.apple.com/us/podcast/why-people-hate-agencies/id1138869817?i=1000744993197",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1138869817?mt=2",
    date_published: "2025-12-10",
    monthly_listens: 6200,
    listeners_per_episode: 6200,
    categories: "B2B Marketing, AI, Growth",
    overall_score: 8.4,
    episode_duration_minutes: 47,
    verdict: "Fit",
    true_emv: 2480,
  },
  {
    show_title: "JUST Branding",
    episode_link: "https://podcasts.apple.com/us/podcast/s06-ep21-best-of-2025-season-6/id1507943911?i=1000743109497",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1507943911?mt=2",
    date_published: "2025-12-18",
    monthly_listens: 3800,
    listeners_per_episode: 3800,
    categories: "AI, Marketing Strategy",
    overall_score: 7.6,
    episode_duration_minutes: 42,
    verdict: "Fit",
    true_emv: 1520,
  },
  {
    show_title: "Leveling Up with Eric Siu",
    episode_link: "https://podcasts.apple.com/us/podcast/the-new-rules-of-b2b-marketing-2026/id741544976?i=1000738711757",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id741544976?mt=2",
    date_published: "2026-01-05",
    monthly_listens: 4100,
    listeners_per_episode: 4100,
    categories: "RevOps, B2B, SaaS",
    overall_score: 7.9,
    episode_duration_minutes: 50,
    verdict: "Fit",
    true_emv: 1640,
  },
  {
    show_title: "Behind the Brand with Bryan Elliott",
    episode_link: "https://podcasts.apple.com/us/podcast/eugene-alletto-turned-his-%2420-rule-into-33-million/id1448210537?i=1000727117779",
    apple_podcast_link: "https://podcasts.apple.com/us/podcast/behind-the-brand-with-bryan-elliott/id1448210537",
    date_published: "2026-01-12",
    monthly_listens: 5400,
    listeners_per_episode: 5400,
    categories: "SaaS, Growth, Startups",
    overall_score: 8.2,
    episode_duration_minutes: 45,
    verdict: "Fit",
    true_emv: 2160,
  },
  {
    show_title: "The Duct Tape Marketing Podcast",
    episode_link: "https://podcasts.apple.com/us/podcast/the-science-of-mindset-and-sustainable-success/id78797836?i=1000741677326",
    apple_podcast_link: "https://podcasts.apple.com/us/podcast/the-duct-tape-marketing-podcast/id78797836",
    date_published: "2026-01-18",
    monthly_listens: 3600,
    listeners_per_episode: 3600,
    categories: "Marketing Ops, Attribution",
    overall_score: 7.4,
    episode_duration_minutes: 39,
    verdict: "Fit",
    true_emv: 1440,
  },
];

export const DEMO_CLIENTS: Record<string, DemoClient> = {
  signalforge: {
    id: "signalforge",
    company: {
      name: "SignalForge AI",
      logo_url: "/demo/signalforge-logo.png",
      brand_colors: { primary: "#3B82F6" },
    },
    speaker: {
      name: "Alex Moreno",
      title: "Founder & CEO",
      talking_points: [
        "From clicks to signals: why traditional marketing metrics fail",
        "Attribution in an AI-driven discovery landscape",
        "How LLMs change visibility, influence, and buyer behavior",
        "AI as a decision-support system for marketing leaders",
        "Measuring performance without false precision",
      ],
      target_audiences: [
        "B2B CMOs and VPs of Marketing",
        "Growth and Demand Generation Leaders",
        "RevOps and Marketing Operations Professionals",
        "Founders scaling go-to-market teams",
      ],
      campaign_strategy: `The campaign is designed to position SignalForge AI as a credible, data-driven voice in the evolving conversation around AI-powered marketing attribution and visibility. Podcast placements focus on depth, executive relevance, and practical insight rather than surface-level AI hype.

By appearing on shows with senior marketing, growth, and RevOps audiences, the campaign aims to reshape how leaders think about performance measurement in an AI-first discovery environment — emphasizing signal-based intelligence, strategic clarity, and better decision-making over vanity metrics.`,
    },
    reportData: {
      client: {
        id: "demo-signalforge",
        name: "Alex Moreno",
        company: "SignalForge AI",
        logo_url: "/demo/signalforge-logo.png",
        title: "Founder & CEO",
        media_kit_url: "",
      },
      company_name: "SignalForge AI",
      report_type: "single",
      batch_name: "SignalForge AI Demo",
      cpm: 50,
      generated_at: new Date().toISOString(),
      kpis: {
        total_evaluated: 18,
        fit_count: 11,
        consider_count: 5,
        not_fit_count: 2,
        avg_score: 9.6,
        total_interviews: 11,
        total_booked: 18,
        total_published: 11,
        total_social_reach: 485000,
        total_reach: 412000,
        total_listeners_per_episode: 36100,
        top_categories: [
          { 
            name: "B2B Marketing", 
            count: 4, 
            podcasts: [{ show_title: "The B2B Growth Show" }] 
          },
          { 
            name: "AI", 
            count: 3, 
            podcasts: [{ show_title: "AI in Marketing" }, { show_title: "The B2B Growth Show" }] 
          },
          { 
            name: "RevOps / Attribution", 
            count: 3, 
            podcasts: [{ show_title: "Revenue Architects" }, { show_title: "Marketing Ops Today" }] 
          },
          { 
            name: "SaaS & Growth", 
            count: 2, 
            podcasts: [{ show_title: "SaaS Growth Talks" }] 
          },
        ],
      },
      podcasts: signalForgePodcasts,
      campaign_overview: {
        strategy: "Throughout the quarter, the campaign focused on establishing SignalForge AI as a credible, data-driven voice in the evolving conversation around AI-powered marketing attribution and visibility. Podcast placements prioritized depth, executive relevance, and alignment with modern go-to-market challenges.",
        executive_summary: "The campaign successfully positioned SignalForge AI as a thought leader at the intersection of AI, attribution, and marketing strategy. Conversations emphasized clarity over hype, helping audiences rethink how performance should be measured in an AI-first discovery landscape.",
        target_audiences: [
          "B2B CMOs and VPs of Marketing",
          "Growth and Demand Generation Leaders",
          "RevOps and Marketing Operations Teams",
          "Founders scaling go-to-market teams",
        ],
        talking_points: [
          "Why traditional attribution models fail in AI-driven discovery",
          "Signal-based measurement vs vanity metrics",
          "How LLMs are reshaping visibility and influence",
          "Using AI to support better marketing decisions, not replace them",
        ],
        pitch_hooks: [
          {
            speaker_name: "Alex Moreno",
            hooks: [
              "AI didn't break marketing — bad measurement did",
              "Why most attribution dashboards lie",
              "What LLMs see that marketers don't",
              "From clicks to signals: rethinking performance",
            ],
          },
        ],
      },
      sov_analysis: {
        client_interview_count: 11,
        client_percentage: 31,
        competitors: [
          {
            name: "GrowthPulse AI",
            role: "AI Marketing Analytics",
            linkedin_url: "",
            interview_count: 15,
            peer_reason: "Competitor in AI-powered marketing analytics space",
          },
          {
            name: "MetricMind",
            role: "Attribution Platform",
            linkedin_url: "",
            interview_count: 9,
            peer_reason: "Competitor in marketing attribution",
          },
        ],
      },
      geo_analysis: {
        geo_score: 76,
        total_podcasts_indexed: 847,
        unique_ai_engines: ["ChatGPT", "Claude", "Perplexity", "Gemini"],
        ai_engine_counts: [
          { engine: "ChatGPT", count: 42 },
          { engine: "Claude", count: 38 },
          { engine: "Perplexity", count: 31 },
          { engine: "Gemini", count: 24 },
        ],
        top_prompts: [
          { prompt: "best marketing attribution tools", count: 15 },
          { prompt: "AI marketing analytics", count: 12 },
          { prompt: "B2B attribution software", count: 9 },
          { prompt: "marketing performance measurement", count: 8 },
        ],
        topic_distribution: [
          { topic: "Marketing Attribution", count: 28 },
          { topic: "AI Analytics", count: 22 },
          { topic: "B2B Marketing", count: 18 },
          { topic: "Performance Measurement", count: 14 },
        ],
        score_breakdown: {
          ai_coverage: 28,
          topic_relevance: 24,
          prompt_diversity: 24,
        },
        podcast_entries: [],
      },
      content_gap_analysis: {
        total_gaps: 37,
        total_prompts: 100,
        coverage_percentage: 63,
        gaps_by_stage: [
          { stage: "Awareness", gap_count: 8, total: 25 },
          { stage: "Consideration", gap_count: 12, total: 30 },
          { stage: "Decision", gap_count: 10, total: 25 },
          { stage: "Retention", gap_count: 7, total: 20 },
        ],
        gaps_by_topic: [
          { topic: "Attribution Modeling", gap_count: 9, total: 15 },
          { topic: "AI Integration", gap_count: 8, total: 14 },
          { topic: "Multi-touch Attribution", gap_count: 7, total: 12 },
          { topic: "Marketing ROI", gap_count: 6, total: 10 },
          { topic: "Data Privacy", gap_count: 4, total: 8 },
        ],
        top_competitors: [
          { name: "GrowthPulse AI", mention_count: 18 },
          { name: "MetricMind", mention_count: 12 },
          { name: "AttriByte", mention_count: 8 },
        ],
        priority_prompts: [
          { prompt: "how to measure marketing ROI with AI", topic: "Marketing ROI", stage: "Consideration", engines_missing: ["Claude", "Gemini"], competitors_present: ["GrowthPulse AI"] },
          { prompt: "best attribution models for B2B", topic: "Attribution Modeling", stage: "Decision", engines_missing: ["Perplexity"], competitors_present: ["MetricMind"] },
          { prompt: "AI-powered marketing analytics comparison", topic: "AI Integration", stage: "Consideration", engines_missing: ["ChatGPT", "Claude"], competitors_present: ["GrowthPulse AI", "AttriByte"] },
        ],
      },
      next_quarter_strategy: {
        quarter: "{{CURRENT_QUARTER}}",
        intro_paragraph: "As we move into {{NEXT_QUARTER}}, the focus will be on expanding SignalForge AI's presence on larger, higher-impact podcasts while deepening conversations around attribution, AI visibility, and executive decision-making.",
        strategic_focus_areas: [
          {
            title: "Executive Marketing Leadership",
            description: "Targeting CMOs and senior marketing leaders responsible for pipeline performance, attribution clarity, and ROI.",
          },
          {
            title: "RevOps & Measurement-Focused Shows",
            description: "Doubling down on podcasts centered on attribution models, data alignment, and AI-assisted reporting.",
          },
          {
            title: "AI-Native GTM Strategy",
            description: "Engaging audiences exploring how AI reshapes content discovery, influence, and buyer behavior.",
          },
        ],
        talking_points_spotlight: [
          { title: "Visibility beyond ranking in AI systems", description: "How to measure presence and influence in LLM-powered discovery" },
          { title: "Why attribution precision is often an illusion", description: "The case for directional signals over false accuracy" },
          { title: "AI as a strategic decision-support layer", description: "Augmenting human judgment, not replacing it" },
          { title: "Moving from channel optimization to signal intelligence", description: "A new framework for marketing measurement" },
        ],
        closing_paragraph: "This next phase is designed to elevate SignalForge AI into more strategic, executive-level conversations — reinforcing authority while expanding reach with the audiences shaping the future of B2B marketing.",
        next_quarter_kpis: {
          high_impact_podcasts_goal: 10,
          listenership_goal: 600000,
          speaker_breakdown: [{ speaker_name: "Alex Moreno", goal: 10 }],
          current_total_reach: 412000,
          current_annual_listenership: 433200,
        },
      },
      target_podcasts: [],
    },
  },
};

// Helper to get dynamic quarter values
export function getDynamicQuarterValues(selectedQuarter: string) {
  const match = selectedQuarter.match(/Q(\d)\s*(\d{4})/);
  if (!match) {
    const now = new Date();
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    const year = now.getFullYear();
    const nextQ = currentQ === 4 ? 1 : currentQ + 1;
    const nextYear = currentQ === 4 ? year + 1 : year;
    return {
      currentQuarter: `Q${currentQ} ${year}`,
      nextQuarter: `Q${nextQ} ${nextYear}`,
    };
  }

  const quarterNum = parseInt(match[1]);
  const year = parseInt(match[2]);
  const nextQ = quarterNum === 4 ? 1 : quarterNum + 1;
  const nextYear = quarterNum === 4 ? year + 1 : year;

  return {
    currentQuarter: `Q${quarterNum} ${year}`,
    nextQuarter: `Q${nextQ} ${nextYear}`,
  };
}

// Apply quarter placeholders to report data
export function applyQuarterToReportData(
  reportData: ReportData,
  selectedQuarter: string
): ReportData {
  const { currentQuarter, nextQuarter } = getDynamicQuarterValues(selectedQuarter);

  const updatedData = JSON.parse(JSON.stringify(reportData)) as ReportData;

  if (updatedData.next_quarter_strategy) {
    updatedData.next_quarter_strategy.quarter = currentQuarter;
    updatedData.next_quarter_strategy.intro_paragraph = updatedData.next_quarter_strategy.intro_paragraph
      ?.replace(/\{\{CURRENT_QUARTER\}\}/g, currentQuarter)
      .replace(/\{\{NEXT_QUARTER\}\}/g, nextQuarter);
    updatedData.next_quarter_strategy.closing_paragraph = updatedData.next_quarter_strategy.closing_paragraph
      ?.replace(/\{\{CURRENT_QUARTER\}\}/g, currentQuarter)
      .replace(/\{\{NEXT_QUARTER\}\}/g, nextQuarter);
  }

  return updatedData;
}

export const DEMO_CLIENT_OPTIONS = Object.entries(DEMO_CLIENTS).map(([id, client]) => ({
  id,
  name: client.company.name,
  speaker: client.speaker.name,
}));
