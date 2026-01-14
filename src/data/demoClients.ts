import { ReportData, PodcastReportEntry, SpeakerBreakdown } from "@/types/reports";

export interface DemoSpeaker {
  id: string;
  name: string;
  title: string;
  talking_points: string[];
  target_audiences: string[];
  campaign_strategy: string;
}

export interface DemoClient {
  id: string;
  company: {
    name: string;
    logo_url: string;
    brand_colors?: { primary: string };
  };
  // Single speaker (backward compatible)
  speaker?: DemoSpeaker;
  // Multi-speaker support
  isMultiSpeaker?: boolean;
  speakers?: DemoSpeaker[];
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
    true_emv: 4850,
    ad_units: 47,
    value_per_minute: 103.19,
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
    true_emv: 3280,
    ad_units: 42,
    value_per_minute: 78.10,
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
    true_emv: 3920,
    ad_units: 50,
    value_per_minute: 78.40,
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
    true_emv: 4410,
    ad_units: 45,
    value_per_minute: 98.00,
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
    true_emv: 2540,
    ad_units: 39,
    value_per_minute: 65.13,
  },
];

// AtlasBridge AI Demo Data (Multi-Speaker)
const mayaReynoldsPodcasts: PodcastReportEntry[] = [
  {
    show_title: "The Modern CEO Podcast",
    episode_link: "https://podcasts.apple.com/us/podcast/ai-agents-automate-decisions-not-just-tasks/id1377522933?i=1000744855885",
    apple_podcast_link: "https://podcasts.apple.com/us/podcast/microsoft-innovation-podcast/id1377522933",
    date_published: "2026-01-08",
    monthly_listens: 18000,
    listeners_per_episode: 18000,
    categories: "Leadership, AI, Business Strategy",
    overall_score: 9.1,
    episode_duration_minutes: 52,
    verdict: "Fit",
    true_emv: 4160,
    ad_units: 52,
    value_per_minute: 80.00,
  },
  {
    show_title: "The Data Stack Show",
    episode_link: "https://podcasts.apple.com/us/podcast/re-air-ai-is-all-about-working-with-data-with/id1526164119?i=1000736400493",
    apple_podcast_link: "https://podcasts.apple.com/us/podcast/the-data-stack-show/id1526164119",
    date_published: "2026-01-15",
    monthly_listens: 14500,
    listeners_per_episode: 14500,
    categories: "Enterprise, Digital Transformation, AI",
    overall_score: 8.7,
    episode_duration_minutes: 47,
    verdict: "Fit",
    true_emv: 3525,
    ad_units: 47,
    value_per_minute: 75.00,
  },
  {
    show_title: "The Artificial Intelligence Show",
    episode_link: "https://podcasts.apple.com/us/podcast/184-openai-code-red-gemini-3-deep-think-recursive-self/id1548733275?i=1000740378437",
    apple_podcast_link: "https://podcasts.apple.com/us/podcast/the-artificial-intelligence-show/id1548733275",
    date_published: "2026-01-22",
    monthly_listens: 11200,
    listeners_per_episode: 11200,
    categories: "Startups, Leadership, SaaS",
    overall_score: 8.5,
    episode_duration_minutes: 45,
    verdict: "Fit",
    true_emv: 2815,
    ad_units: 45,
    value_per_minute: 62.56,
  },
];

const danielOrtizPodcasts: PodcastReportEntry[] = [
  {
    show_title: "Compliance Conversations by Healthicity",
    episode_link: "https://podcasts.apple.com/us/podcast/rethinking-critical-care-coding-beyond-the-bedside/id1166347965?i=1000737578312",
    apple_podcast_link: "https://podcasts.apple.com/us/podcast/compliance-conversations-by-healthicity/id1166347965",
    date_published: "2026-01-10",
    monthly_listens: 15400,
    listeners_per_episode: 15400,
    categories: "Data, AI, Engineering",
    overall_score: 8.9,
    episode_duration_minutes: 50,
    verdict: "Fit",
    true_emv: 3350,
    ad_units: 50,
    value_per_minute: 67.00,
  },
  {
    show_title: "Data Center Go-to-Market Podcast",
    episode_link: "https://podcasts.apple.com/md/podcast/ep-163-joshua-feinberg-ceo-at-dcsmi-data-center-go/id1752776558?i=1000743409735",
    apple_podcast_link: "https://podcasts.apple.com/md/podcast/data-center-go-to-market-podcast/id1752776558",
    date_published: "2026-01-18",
    monthly_listens: 12800,
    listeners_per_episode: 12800,
    categories: "CIO, IT Strategy, Enterprise Tech",
    overall_score: 8.6,
    episode_duration_minutes: 48,
    verdict: "Fit",
    true_emv: 2880,
    ad_units: 48,
    value_per_minute: 60.00,
  },
  {
    show_title: "Gaining the Technology Leadership Edge",
    episode_link: "https://podcasts.apple.com/us/podcast/what-scaling-leaders-miss-about-ownership-when-growth/id1664607772?i=1000730839666",
    apple_podcast_link: "https://podcasts.apple.com/us/podcast/gaining-the-technology-leadership-edge/id1664607772",
    date_published: "2026-01-25",
    monthly_listens: 10900,
    listeners_per_episode: 10900,
    categories: "Security, Architecture, Cloud",
    overall_score: 8.3,
    episode_duration_minutes: 44,
    verdict: "Fit",
    true_emv: 2270,
    ad_units: 44,
    value_per_minute: 51.59,
  },
];

// Combine all AtlasBridge podcasts for company-level data
const atlasBridgePodcasts: PodcastReportEntry[] = [...mayaReynoldsPodcasts, ...danielOrtizPodcasts];

// Speaker breakdowns for AtlasBridge AI
const atlasBridgeSpeakerBreakdowns: SpeakerBreakdown[] = [
  {
    speaker_id: "maya-reynolds",
    speaker_name: "Maya Reynolds",
    speaker_title: "Founder & CEO",
    campaign_strategy: "Position Maya as a founder-led executive voice on enterprise AI adoption, organizational readiness, and leadership through transformation. Her campaign focuses on helping CEOs and senior leaders understand where AI creates real business leverage — and where initiatives fail without alignment, governance, and clarity.",
    target_audiences: [
      "Enterprise CEOs and Founders",
      "CIOs and Chief Digital Officers",
      "Senior business leaders driving AI initiatives",
      "Board-level decision-makers evaluating AI investment",
    ],
    talking_points: [
      "Moving from AI experimentation to enterprise execution",
      "Why AI strategies fail without leadership alignment",
      "Data readiness as the foundation of AI success",
      "Executive decision-making in AI-driven organizations",
      "Balancing innovation velocity with operational responsibility",
    ],
    kpis: {
      total_booked: 14,
      total_published: 9,
      total_reach: 43700,
      total_social_reach: 145000,
      avg_score: 8.8,
      total_emv: 10500,
    },
    podcasts: mayaReynoldsPodcasts,
  },
  {
    speaker_id: "daniel-ortiz",
    speaker_name: "Daniel Ortiz",
    speaker_title: "Chief Technology & Data Officer",
    campaign_strategy: "Position Daniel as a trusted technical authority on AI infrastructure, data governance, and secure deployment at scale. His campaign translates complex technical realities into practical guidance for IT and data leaders responsible for building systems that actually support AI outcomes.",
    target_audiences: [
      "CIOs and CTOs",
      "Heads of Data and AI Engineering",
      "Enterprise IT and Platform Leaders",
      "Security and Architecture Teams",
    ],
    talking_points: [
      "Data governance as the backbone of enterprise AI",
      "Why copilots and agents fail in poorly governed environments",
      "Designing scalable, secure AI architectures",
      "Aligning AI infrastructure with business outcomes",
      "Preventing AI sprawl across large organizations",
    ],
    kpis: {
      total_booked: 12,
      total_published: 8,
      total_reach: 39100,
      total_social_reach: 118000,
      avg_score: 8.6,
      total_emv: 8500,
    },
    podcasts: danielOrtizPodcasts,
  },
];

export const DEMO_CLIENTS: Record<string, DemoClient> = {
  signalforge: {
    id: "signalforge",
    company: {
      name: "SignalForge AI",
      logo_url: "/demo/signalforge-logo.png",
      brand_colors: { primary: "#6366F1" },
    },
    speaker: {
      id: "alex-moreno",
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
          { name: "B2B Marketing", count: 4, podcasts: [{ show_title: "The B2B Growth Show" }] },
          { name: "AI", count: 3, podcasts: [{ show_title: "AI in Marketing" }, { show_title: "The B2B Growth Show" }] },
          { name: "RevOps / Attribution", count: 3, podcasts: [{ show_title: "Revenue Architects" }, { show_title: "Marketing Ops Today" }] },
          { name: "SaaS & Growth", count: 2, podcasts: [{ show_title: "SaaS Growth Talks" }] },
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
          { name: "GrowthPulse AI", role: "AI Marketing Analytics", linkedin_url: "", interview_count: 15, peer_reason: "Competitor in AI-powered marketing analytics space" },
          { name: "MetricMind", role: "Attribution Platform", linkedin_url: "", interview_count: 9, peer_reason: "Competitor in marketing attribution" },
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
          { title: "Tier-1 Marketing Podcasts", description: "Targeting top-tier marketing and growth podcasts with 50K+ monthly listeners to maximize brand visibility." },
          { title: "Executive-Level Conversations", description: "Prioritizing shows with CMO and VP-level audiences for strategic positioning." },
          { title: "AI Thought Leadership", description: "Expanding presence on AI-focused shows to establish authority in AI-powered marketing intelligence." },
        ],
        talking_points_spotlight: [
          { title: "The death of last-click attribution", description: "Why modern marketing needs signal-based measurement" },
          { title: "AI visibility in the enterprise", description: "How LLMs are changing brand discovery" },
        ],
        closing_paragraph: "By focusing on high-impact placements and deepening our AI narrative, {{NEXT_QUARTER}} will solidify SignalForge AI's position as the leading voice in AI-powered marketing intelligence.",
        next_quarter_kpis: {
          high_impact_podcasts_goal: 15,
          listenership_goal: 600000,
          current_total_reach: 412000,
          current_annual_listenership: 485000,
        },
      },
      target_podcasts: [],
    },
  },
  atlasbridge: {
    id: "atlasbridge",
    company: {
      name: "AtlasBridge AI",
      logo_url: "/demo/atlasbridge-logo.png",
      brand_colors: { primary: "#3B82F6" },
    },
    isMultiSpeaker: true,
    speakers: [
      {
        id: "maya-reynolds",
        name: "Maya Reynolds",
        title: "Founder & CEO",
        talking_points: [
          "Moving from AI experimentation to enterprise execution",
          "Why AI strategies fail without leadership alignment",
          "Data readiness as the foundation of AI success",
          "Executive decision-making in AI-driven organizations",
          "Balancing innovation velocity with operational responsibility",
        ],
        target_audiences: [
          "Enterprise CEOs and Founders",
          "CIOs and Chief Digital Officers",
          "Senior business leaders driving AI initiatives",
          "Board-level decision-makers evaluating AI investment",
        ],
        campaign_strategy: "Position Maya as a founder-led executive voice on enterprise AI adoption, organizational readiness, and leadership through transformation. Her campaign focuses on helping CEOs and senior leaders understand where AI creates real business leverage — and where initiatives fail without alignment, governance, and clarity.",
      },
      {
        id: "daniel-ortiz",
        name: "Daniel Ortiz",
        title: "Chief Technology & Data Officer",
        talking_points: [
          "Data governance as the backbone of enterprise AI",
          "Why copilots and agents fail in poorly governed environments",
          "Designing scalable, secure AI architectures",
          "Aligning AI infrastructure with business outcomes",
          "Preventing AI sprawl across large organizations",
        ],
        target_audiences: [
          "CIOs and CTOs",
          "Heads of Data and AI Engineering",
          "Enterprise IT and Platform Leaders",
          "Security and Architecture Teams",
        ],
        campaign_strategy: "Position Daniel as a trusted technical authority on AI infrastructure, data governance, and secure deployment at scale. His campaign translates complex technical realities into practical guidance for IT and data leaders responsible for building systems that actually support AI outcomes.",
      },
    ],
    reportData: {
      client: {
        id: "demo-atlasbridge",
        name: "AtlasBridge AI",
        company: "AtlasBridge AI",
        logo_url: "/demo/atlasbridge-logo.png",
        title: "",
        media_kit_url: "",
      },
      company_name: "AtlasBridge AI",
      report_type: "multi",
      batch_name: "AtlasBridge AI Demo",
      cpm: 50,
      generated_at: new Date().toISOString(),
      speaker_breakdowns: atlasBridgeSpeakerBreakdowns,
      kpis: {
        // Aggregated from both speakers
        total_evaluated: 26,
        fit_count: 17,
        consider_count: 7,
        not_fit_count: 2,
        avg_score: 8.7,
        total_interviews: 17,
        total_booked: 26, // 14 + 12
        total_published: 17, // 9 + 8
        total_social_reach: 263000, // 145K + 118K
        total_reach: 82800, // 43,700 + 39,100
        total_listeners_per_episode: 13700,
        top_categories: [
          { name: "AI", count: 6, podcasts: [{ show_title: "The Modern CEO Podcast" }, { show_title: "The Artificial Intelligence Show" }] },
          { name: "Leadership", count: 4, podcasts: [{ show_title: "The Modern CEO Podcast" }, { show_title: "Gaining the Technology Leadership Edge" }] },
          { name: "Enterprise Tech", count: 4, podcasts: [{ show_title: "Data Center Go-to-Market Podcast" }] },
          { name: "Data", count: 3, podcasts: [{ show_title: "The Data Stack Show" }, { show_title: "Compliance Conversations by Healthicity" }] },
        ],
      },
      podcasts: atlasBridgePodcasts,
      campaign_overview: {
        strategy: "This campaign positions AtlasBridge AI as a trusted enterprise partner by pairing executive vision with deep technical credibility. The multi-speaker approach allows the company to engage both strategic decision-makers and technical leaders responsible for implementing AI at scale.",
        executive_summary: "By activating two complementary voices, AtlasBridge AI successfully owns the conversation across AI strategy and execution. Podcast appearances reinforce the message that sustainable AI success requires leadership alignment, data readiness, and strong technical foundations.",
        target_audiences: [
          "Enterprise CEOs and Founders",
          "CIOs, CTOs, and Chief Digital Officers",
          "Heads of Data, AI, and Platform Engineering",
          "Senior IT and Security Leaders",
        ],
        talking_points: [
          "Operationalizing AI at enterprise scale",
          "Data readiness and governance as prerequisites for AI",
          "Aligning AI initiatives with measurable business outcomes",
          "Managing risk while enabling innovation",
          "Avoiding fragmented or experimental AI adoption",
        ],
        pitch_hooks: [
          {
            speaker_name: "Maya Reynolds",
            hooks: [
              "Why most enterprise AI strategies fail before deployment",
              "AI leadership isn't technical — it's organizational",
              "From pilot purgatory to real AI impact",
              "Why AI success starts in the boardroom",
            ],
          },
          {
            speaker_name: "Daniel Ortiz",
            hooks: [
              "Why copilots fail without data governance",
              "The hidden architecture problems behind AI hype",
              "Building AI systems enterprises can actually trust",
              "Scaling AI without creating technical chaos",
            ],
          },
        ],
      },
      sov_analysis: {
        client_interview_count: 17,
        client_percentage: 31,
        competitors: [
          { name: "NextWave Consulting", role: "Enterprise AI Advisory", linkedin_url: "", interview_count: 17, peer_reason: "Competitor in enterprise AI consulting" },
          { name: "Stratus Digital", role: "Cloud & AI Services", linkedin_url: "", interview_count: 13, peer_reason: "Competitor in cloud and AI services" },
          { name: "NovaStack Labs", role: "Data Infrastructure", linkedin_url: "", interview_count: 11, peer_reason: "Competitor in data infrastructure" },
        ],
      },
      geo_analysis: {
        geo_score: 74,
        total_podcasts_indexed: 723,
        unique_ai_engines: ["ChatGPT", "Claude", "Perplexity", "Gemini"],
        ai_engine_counts: [
          { engine: "ChatGPT", count: 40 },
          { engine: "Claude", count: 35 },
          { engine: "Perplexity", count: 30 },
          { engine: "Gemini", count: 22 },
        ],
        top_prompts: [
          { prompt: "enterprise AI implementation", count: 16 },
          { prompt: "AI governance frameworks", count: 13 },
          { prompt: "data readiness for AI", count: 11 },
          { prompt: "AI infrastructure best practices", count: 9 },
        ],
        topic_distribution: [
          { topic: "Enterprise AI", count: 34 },
          { topic: "Data Governance", count: 26 },
          { topic: "AI Leadership", count: 20 },
          { topic: "AI Infrastructure", count: 18 },
        ],
        score_breakdown: {
          ai_coverage: 27,
          topic_relevance: 25,
          prompt_diversity: 22,
        },
        podcast_entries: [],
      },
      content_gap_analysis: {
        total_gaps: 40,
        total_prompts: 100,
        coverage_percentage: 60,
        gaps_by_stage: [
          { stage: "Awareness", gap_count: 9, total: 25 },
          { stage: "Consideration", gap_count: 13, total: 30 },
          { stage: "Decision", gap_count: 11, total: 25 },
          { stage: "Retention", gap_count: 7, total: 20 },
        ],
        gaps_by_topic: [
          { topic: "AI Governance Frameworks", gap_count: 10, total: 16 },
          { topic: "Executive AI Readiness", gap_count: 9, total: 15 },
          { topic: "AI Infrastructure Security", gap_count: 8, total: 14 },
          { topic: "Data Readiness", gap_count: 7, total: 12 },
          { topic: "AI ROI Measurement", gap_count: 6, total: 10 },
        ],
        top_competitors: [
          { name: "NextWave Consulting", mention_count: 20 },
          { name: "Stratus Digital", mention_count: 15 },
          { name: "NovaStack Labs", mention_count: 10 },
        ],
        priority_prompts: [
          { prompt: "how to implement AI governance in enterprise", topic: "AI Governance Frameworks", stage: "Consideration", engines_missing: ["Claude", "Gemini"], competitors_present: ["NextWave Consulting"] },
          { prompt: "AI readiness assessment for CEOs", topic: "Executive AI Readiness", stage: "Awareness", engines_missing: ["Perplexity"], competitors_present: ["Stratus Digital"] },
          { prompt: "secure AI infrastructure for enterprises", topic: "AI Infrastructure Security", stage: "Decision", engines_missing: ["ChatGPT", "Claude"], competitors_present: ["NovaStack Labs"] },
        ],
      },
      next_quarter_strategy: {
        quarter: "{{CURRENT_QUARTER}}",
        intro_paragraph: "Moving into {{NEXT_QUARTER}}, AtlasBridge AI will expand its podcast presence by targeting tier-1 executive and technical podcasts. Maya will focus on boardroom-level AI strategy, while Daniel will double down on data governance and AI infrastructure security.",
        strategic_focus_areas: [
          { title: "Board-Level AI Podcasts", description: "Prioritizing shows with CEO, board member, and investor audiences to maximize Maya's executive positioning." },
          { title: "Technical Leadership Series", description: "Daniel leading conversations on AI infrastructure, security, and data governance for CIO/CTO audiences." },
          { title: "Joint Executive-Technical Appearances", description: "Exploring opportunities for joint appearances on enterprise transformation podcasts." },
        ],
        talking_points_spotlight: [
          { title: "The organizational prerequisites for AI success", description: "Why technology alone doesn't drive AI transformation" },
          { title: "Building AI systems that scale securely", description: "Architecture decisions that make or break enterprise AI" },
        ],
        speaker_talking_points_spotlight: [
          {
            speaker_name: "Maya Reynolds",
            points: [
              { title: "AI as a boardroom priority", description: "How to position AI initiatives for executive buy-in" },
              { title: "From experimentation to execution", description: "The leadership framework for AI transformation" },
            ],
          },
          {
            speaker_name: "Daniel Ortiz",
            points: [
              { title: "The data governance imperative", description: "Why AI fails without proper data foundations" },
              { title: "Preventing AI sprawl", description: "Building centralized, scalable AI infrastructure" },
            ],
          },
        ],
        closing_paragraph: "This quarter's strategy positions AtlasBridge AI as the definitive voice on enterprise AI transformation — combining executive leadership with deep technical expertise to guide organizations from AI ambition to AI execution.",
        next_quarter_kpis: {
          high_impact_podcasts_goal: 20, // 10 per speaker
          listenership_goal: 99360, // 20% higher than current 82,800
          speaker_breakdown: [
            { speaker_name: "Maya Reynolds", goal: 10 },
            { speaker_name: "Daniel Ortiz", goal: 10 },
          ],
          current_total_reach: 82800,
          current_annual_listenership: 164400,
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

// Helper to get speaker display for DEMO_CLIENT_OPTIONS
export const DEMO_CLIENT_OPTIONS = Object.entries(DEMO_CLIENTS).map(([id, client]) => ({
  id,
  name: client.company.name,
  isMultiSpeaker: client.isMultiSpeaker || false,
  speaker: client.speaker?.name || "",
  speakers: client.speakers?.map(s => ({ name: s.name, title: s.title })) || [],
}));
