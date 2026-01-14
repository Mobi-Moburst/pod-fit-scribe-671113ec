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

// Vertex Ventures Demo Data (Multi-Speaker)
const sarahChenPodcasts: PodcastReportEntry[] = [
  {
    show_title: "The Venture Voice",
    episode_link: "https://podcasts.apple.com/us/podcast/future-of-b2b-saas-investing/id1234567890?i=1000745001001",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1234567890?mt=2",
    date_published: "2025-11-15",
    monthly_listens: 8200,
    listeners_per_episode: 8200,
    categories: "Venture Capital, SaaS, Startups",
    overall_score: 9.1,
    episode_duration_minutes: 52,
    verdict: "Fit",
    true_emv: 4280,
    ad_units: 52,
    value_per_minute: 82.31,
  },
  {
    show_title: "Founder Fridays",
    episode_link: "https://podcasts.apple.com/us/podcast/what-vcs-really-look-for/id1234567891?i=1000745001002",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1234567891?mt=2",
    date_published: "2025-12-02",
    monthly_listens: 5600,
    listeners_per_episode: 5600,
    categories: "Entrepreneurship, VC, Funding",
    overall_score: 8.7,
    episode_duration_minutes: 45,
    verdict: "Fit",
    true_emv: 2940,
    ad_units: 45,
    value_per_minute: 65.33,
  },
  {
    show_title: "Scale or Fail",
    episode_link: "https://podcasts.apple.com/us/podcast/from-seed-to-series-b/id1234567892?i=1000745001003",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1234567892?mt=2",
    date_published: "2025-12-20",
    monthly_listens: 4100,
    listeners_per_episode: 4100,
    categories: "Growth, SaaS, B2B",
    overall_score: 8.2,
    episode_duration_minutes: 38,
    verdict: "Fit",
    true_emv: 2150,
    ad_units: 38,
    value_per_minute: 56.58,
  },
  {
    show_title: "The Cap Table",
    episode_link: "https://podcasts.apple.com/us/podcast/navigating-down-rounds/id1234567893?i=1000745001004",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1234567893?mt=2",
    date_published: "2026-01-08",
    monthly_listens: 6800,
    listeners_per_episode: 6800,
    categories: "Finance, VC, Investment",
    overall_score: 8.9,
    episode_duration_minutes: 55,
    verdict: "Fit",
    true_emv: 3520,
    ad_units: 55,
    value_per_minute: 64.00,
  },
];

const marcusReidPodcasts: PodcastReportEntry[] = [
  {
    show_title: "Growth Operators",
    episode_link: "https://podcasts.apple.com/us/podcast/scaling-from-10m-to-100m/id1234567894?i=1000745002001",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1234567894?mt=2",
    date_published: "2025-11-22",
    monthly_listens: 7400,
    listeners_per_episode: 7400,
    categories: "Growth, Operations, SaaS",
    overall_score: 8.8,
    episode_duration_minutes: 48,
    verdict: "Fit",
    true_emv: 3120,
    ad_units: 48,
    value_per_minute: 65.00,
  },
  {
    show_title: "The PLG Podcast",
    episode_link: "https://podcasts.apple.com/us/podcast/when-plg-meets-sales/id1234567895?i=1000745002002",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1234567895?mt=2",
    date_published: "2025-12-10",
    monthly_listens: 4800,
    listeners_per_episode: 4800,
    categories: "Product-Led Growth, GTM, SaaS",
    overall_score: 8.4,
    episode_duration_minutes: 42,
    verdict: "Fit",
    true_emv: 2050,
    ad_units: 42,
    value_per_minute: 48.81,
  },
  {
    show_title: "Revenue Builders",
    episode_link: "https://podcasts.apple.com/us/podcast/building-efficient-growth-engines/id1234567896?i=1000745002003",
    apple_podcast_link: "https://geo.itunes.apple.com/us/podcast/id1234567896?mt=2",
    date_published: "2026-01-05",
    monthly_listens: 5200,
    listeners_per_episode: 5200,
    categories: "Revenue, GTM, Sales",
    overall_score: 8.1,
    episode_duration_minutes: 50,
    verdict: "Fit",
    true_emv: 2180,
    ad_units: 50,
    value_per_minute: 43.60,
  },
];

// Combine all Vertex podcasts for company-level data
const vertexVenturesPodcasts: PodcastReportEntry[] = [...sarahChenPodcasts, ...marcusReidPodcasts];

// Speaker breakdowns for Vertex Ventures
const vertexSpeakerBreakdowns: SpeakerBreakdown[] = [
  {
    speaker_id: "sarah-chen",
    speaker_name: "Sarah Chen",
    speaker_title: "Managing Partner",
    campaign_strategy: "Position Sarah as a leading voice on early-stage SaaS investing, founder-market fit, and what separates good companies from great ones. Focus on podcasts with LP, founder, and operator audiences.",
    target_audiences: [
      "SaaS Founders seeking Series A-B funding",
      "LP investors evaluating VC funds",
      "First-time founders navigating fundraising",
    ],
    talking_points: [
      "Why founder-market fit matters more than TAM in early-stage",
      "The signals we look for before leading a seed round",
      "Building conviction vs. following consensus",
      "How the best founders handle board dynamics",
    ],
    kpis: {
      total_booked: 10,
      total_published: 4,
      total_reach: 248700,
      total_social_reach: 186000,
      avg_score: 8.7,
      total_emv: 12890,
    },
    podcasts: sarahChenPodcasts,
  },
  {
    speaker_id: "marcus-reid",
    speaker_name: "Marcus Reid",
    speaker_title: "Partner, Growth",
    campaign_strategy: "Establish Marcus as the go-to expert on scaling B2B SaaS from $10M to $100M ARR. Target podcasts focused on GTM, growth operations, and efficient scaling.",
    target_audiences: [
      "Series B-C CEOs and COOs",
      "VP of Growth and Revenue leaders",
      "PLG practitioners and GTM strategists",
    ],
    talking_points: [
      "The playbook for efficient growth in a post-ZIRP world",
      "When to layer sales onto product-led growth",
      "Metrics that matter: CAC payback vs. growth rate",
      "Building growth teams that scale with the company",
    ],
    kpis: {
      total_booked: 8,
      total_published: 3,
      total_reach: 174000,
      total_social_reach: 142000,
      avg_score: 8.4,
      total_emv: 7350,
    },
    podcasts: marcusReidPodcasts,
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
  vertexventures: {
    id: "vertexventures",
    company: {
      name: "Vertex Ventures",
      logo_url: "", // No logo - will use initials
      brand_colors: { primary: "#10B981" },
    },
    isMultiSpeaker: true,
    speakers: [
      {
        id: "sarah-chen",
        name: "Sarah Chen",
        title: "Managing Partner",
        talking_points: [
          "Why founder-market fit matters more than TAM in early-stage",
          "The signals we look for before leading a seed round",
          "Building conviction vs. following consensus",
          "How the best founders handle board dynamics",
        ],
        target_audiences: [
          "SaaS Founders seeking Series A-B funding",
          "LP investors evaluating VC funds",
          "First-time founders navigating fundraising",
        ],
        campaign_strategy: "Position Sarah as a leading voice on early-stage SaaS investing, founder-market fit, and what separates good companies from great ones.",
      },
      {
        id: "marcus-reid",
        name: "Marcus Reid",
        title: "Partner, Growth",
        talking_points: [
          "The playbook for efficient growth in a post-ZIRP world",
          "When to layer sales onto product-led growth",
          "Metrics that matter: CAC payback vs. growth rate",
          "Building growth teams that scale with the company",
        ],
        target_audiences: [
          "Series B-C CEOs and COOs",
          "VP of Growth and Revenue leaders",
          "PLG practitioners and GTM strategists",
        ],
        campaign_strategy: "Establish Marcus as the go-to expert on scaling B2B SaaS from $10M to $100M ARR.",
      },
    ],
    reportData: {
      client: {
        id: "demo-vertex",
        name: "Vertex Ventures",
        company: "Vertex Ventures",
        logo_url: "",
        title: "",
        media_kit_url: "",
      },
      company_name: "Vertex Ventures",
      report_type: "multi",
      batch_name: "Vertex Ventures Demo",
      cpm: 50,
      generated_at: new Date().toISOString(),
      speaker_breakdowns: vertexSpeakerBreakdowns,
      kpis: {
        // Aggregated from both speakers
        total_evaluated: 24,
        fit_count: 16,
        consider_count: 6,
        not_fit_count: 2,
        avg_score: 8.6,
        total_interviews: 14,
        total_booked: 18, // 10 + 8
        total_published: 7, // 4 + 3
        total_social_reach: 328000, // 186K + 142K
        total_reach: 422700, // Sum of both speakers
        total_listeners_per_episode: 42100,
        top_categories: [
          { 
            name: "Venture Capital", 
            count: 5, 
            podcasts: [{ show_title: "The Venture Voice" }, { show_title: "The Cap Table" }] 
          },
          { 
            name: "SaaS", 
            count: 4, 
            podcasts: [{ show_title: "Scale or Fail" }, { show_title: "Growth Operators" }] 
          },
          { 
            name: "Growth", 
            count: 4, 
            podcasts: [{ show_title: "Growth Operators" }, { show_title: "The PLG Podcast" }] 
          },
          { 
            name: "GTM / Revenue", 
            count: 3, 
            podcasts: [{ show_title: "Revenue Builders" }] 
          },
        ],
      },
      podcasts: vertexVenturesPodcasts,
      campaign_overview: {
        strategy: "The campaign is structured to position Vertex Ventures as the definitive voice on B2B SaaS investing and scaling, with Sarah Chen focusing on early-stage investing insights and Marcus Reid covering growth-stage operational excellence. Together, they cover the full founder journey from seed to scale.",
        executive_summary: "Vertex Ventures successfully established dual thought leadership tracks. Sarah Chen's appearances built credibility with early-stage founders and LPs, while Marcus Reid's conversations resonated strongly with growth-stage operators and revenue leaders. The combined effort created a comprehensive narrative around Vertex's full-cycle investment approach.",
        target_audiences: [
          "B2B SaaS Founders (Seed to Series C)",
          "LP investors and fund allocators",
          "Growth and Revenue leaders at scaling companies",
          "First-time and repeat founders",
        ],
        talking_points: [
          "The signals that separate good companies from great ones",
          "Efficient growth strategies in a capital-constrained environment",
          "Building conviction in early-stage investing",
          "When and how to layer sales onto product-led growth",
        ],
        pitch_hooks: [
          {
            speaker_name: "Sarah Chen",
            hooks: [
              "Why we passed on 50 unicorns — and don't regret it",
              "The founder red flags that don't show up in pitch decks",
              "What LPs really ask behind closed doors",
              "Building a fund that founders actually want",
            ],
          },
          {
            speaker_name: "Marcus Reid",
            hooks: [
              "The growth playbook is dead — here's what replaced it",
              "Why your CAC payback matters more than your growth rate",
              "The PLG to sales handoff nobody talks about",
              "Scaling from $10M to $100M without burning out",
            ],
          },
        ],
      },
      sov_analysis: {
        client_interview_count: 14,
        client_percentage: 28,
        competitors: [
          {
            name: "Emergence Capital",
            role: "Enterprise SaaS VC",
            linkedin_url: "",
            interview_count: 18,
            peer_reason: "Competitor in B2B SaaS investing",
          },
          {
            name: "OpenView Partners",
            role: "Growth Stage VC",
            linkedin_url: "",
            interview_count: 12,
            peer_reason: "Competitor in growth-stage SaaS",
          },
        ],
      },
      geo_analysis: {
        geo_score: 72,
        total_podcasts_indexed: 623,
        unique_ai_engines: ["ChatGPT", "Claude", "Perplexity", "Gemini"],
        ai_engine_counts: [
          { engine: "ChatGPT", count: 38 },
          { engine: "Claude", count: 32 },
          { engine: "Perplexity", count: 28 },
          { engine: "Gemini", count: 20 },
        ],
        top_prompts: [
          { prompt: "best B2B SaaS investors", count: 14 },
          { prompt: "top venture capital firms for startups", count: 11 },
          { prompt: "growth stage VC firms", count: 9 },
          { prompt: "SaaS investing trends", count: 7 },
        ],
        topic_distribution: [
          { topic: "Venture Capital", count: 32 },
          { topic: "SaaS Investing", count: 26 },
          { topic: "Startup Funding", count: 20 },
          { topic: "Growth Strategy", count: 16 },
        ],
        score_breakdown: {
          ai_coverage: 26,
          topic_relevance: 24,
          prompt_diversity: 22,
        },
        podcast_entries: [],
      },
      content_gap_analysis: {
        total_gaps: 42,
        total_prompts: 100,
        coverage_percentage: 58,
        gaps_by_stage: [
          { stage: "Awareness", gap_count: 10, total: 25 },
          { stage: "Consideration", gap_count: 14, total: 30 },
          { stage: "Decision", gap_count: 12, total: 25 },
          { stage: "Retention", gap_count: 6, total: 20 },
        ],
        gaps_by_topic: [
          { topic: "Fund Strategy", gap_count: 11, total: 18 },
          { topic: "Portfolio Support", gap_count: 9, total: 15 },
          { topic: "Deal Sourcing", gap_count: 8, total: 14 },
          { topic: "Growth Metrics", gap_count: 7, total: 12 },
          { topic: "LP Relations", gap_count: 5, total: 10 },
        ],
        top_competitors: [
          { name: "Emergence Capital", mention_count: 22 },
          { name: "OpenView Partners", mention_count: 16 },
          { name: "Bessemer Venture Partners", mention_count: 12 },
        ],
        priority_prompts: [
          { prompt: "best VCs for B2B SaaS Series A", topic: "Fund Strategy", stage: "Decision", engines_missing: ["Claude", "Perplexity"], competitors_present: ["Emergence Capital"] },
          { prompt: "how VCs help portfolio companies scale", topic: "Portfolio Support", stage: "Consideration", engines_missing: ["Gemini"], competitors_present: ["OpenView Partners"] },
          { prompt: "growth stage SaaS metrics investors care about", topic: "Growth Metrics", stage: "Consideration", engines_missing: ["ChatGPT", "Claude"], competitors_present: ["Bessemer Venture Partners"] },
        ],
      },
      next_quarter_strategy: {
        quarter: "{{CURRENT_QUARTER}}",
        intro_paragraph: "Moving into {{NEXT_QUARTER}}, Vertex Ventures will expand its podcast presence by targeting tier-1 founder and investor podcasts. Sarah will focus on fundraising and founder psychology, while Marcus will double down on operational scaling and growth efficiency.",
        strategic_focus_areas: [
          {
            title: "Tier-1 VC & Founder Podcasts",
            description: "Prioritizing high-reach shows with founder and LP audiences to maximize brand visibility.",
          },
          {
            title: "Operational Excellence Series",
            description: "Marcus leading conversations on building efficient, scalable growth engines.",
          },
          {
            title: "Fundraising Masterclass Content",
            description: "Sarah providing tactical advice for founders navigating the fundraising process.",
          },
        ],
        talking_points_spotlight: [
          { title: "The new rules of fundraising in 2026", description: "What's changed and what founders need to know" },
          { title: "Efficient growth as a competitive advantage", description: "Why capital efficiency wins in the long run" },
        ],
        speaker_talking_points_spotlight: [
          {
            speaker_name: "Sarah Chen",
            points: [
              { title: "Reading between the lines of a term sheet", description: "What matters beyond the headline valuation" },
              { title: "Building a board that actually helps", description: "How to get value from your investors" },
            ],
          },
          {
            speaker_name: "Marcus Reid",
            points: [
              { title: "The metrics dashboard every growth leader needs", description: "Tracking what matters vs. what looks good" },
              { title: "When to hire your first growth team", description: "Timing and structure for scaling" },
            ],
          },
        ],
        closing_paragraph: "This quarter's strategy positions Vertex Ventures as the firm that truly understands the full founder journey — from first check to IPO — with practical, operator-tested insights at every stage.",
        next_quarter_kpis: {
          high_impact_podcasts_goal: 18, // 9 per speaker
          listenership_goal: 550000,
          speaker_breakdown: [
            { speaker_name: "Sarah Chen", goal: 9 },
            { speaker_name: "Marcus Reid", goal: 9 },
          ],
          current_total_reach: 422700,
          current_annual_listenership: 505000,
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
