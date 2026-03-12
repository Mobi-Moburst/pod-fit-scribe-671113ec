import { MinimalClient } from './clients';

// Target Podcast for next quarter recommendations
export interface TargetPodcast {
  podcast_name: string;
  description: string;
  pitch_angle: string;
  talking_points: string[];
  target_audience: string;
  apple_podcast_url?: string;
  cover_art_url?: string;
}

// Content Gap Analysis types
export interface ContentGapAnalysis {
  total_gaps: number; // Total prompts where client is absent in all engines
  total_prompts: number;
  coverage_percentage: number; // Prompts where present in at least one engine / total
  
  // By journey stage
  gaps_by_stage: Array<{ stage: string; gap_count: number; total: number }>;
  
  // By topic
  gaps_by_topic: Array<{ topic: string; gap_count: number; total: number }>;
  
  // Competitor frequency (who's showing up most)
  top_competitors: Array<{ name: string; mention_count: number }>;
  
  // Priority gaps (most engines missing + competitors present)
  priority_prompts: Array<{
    prompt: string;
    topic: string;
    stage: string;
    engines_missing: string[];
    competitors_present: string[];
  }>;
  
  // AI-generated recommendations (populated on-demand)
  ai_recommendations?: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    related_topics: string[];
  }>;
}

// Per-speaker breakdown for multi-speaker reports
export interface SpeakerBreakdown {
  speaker_id: string;
  speaker_name: string;
  speaker_title?: string;
  speaker_headshot_url?: string;
  airtable_embed_url?: string;
  
  // Strategy insights from speaker profile
  campaign_strategy?: string;
  target_audiences?: string[];
  talking_points?: string[];
  professional_credentials?: string[];
  
  // Per-speaker KPIs (subset - individual counts/reach)
  kpis: {
    total_booked: number;
    total_published: number;
    total_recorded?: number;
    total_reach: number;
    total_social_reach: number;
    avg_score: number;
    total_emv?: number;
  };
  
  podcasts: PodcastReportEntry[]; // Individual speaker podcasts
}

export interface PodcastReportEntry {
  // From Batch CSV
  show_title: string;
  verdict: 'Fit' | 'Consider' | 'Not';
  overall_score: number;
  listeners_per_episode?: number;
  monthly_listens?: number; // Total monthly listeners for the show
  social_reach?: number;
  categories?: string;
  rationale_short?: string;
  
  // From Airtable CSV
  apple_podcast_link?: string;
  action?: string; // 'podcast recording', 'intro call', 'pending reschedule'
  scheduled_date_time?: string;
  show_notes?: string;
  date_booked?: string;
  date_published?: string;
  episode_link?: string;
  
  // From scraping (if episode_link exists)
  episode_duration_minutes?: number;
  duration_scraped?: boolean; // Flag to indicate if scraping was attempted
  
  // EMV calculations
  base_emv?: number;
  speaking_minutes?: number;
  ad_units?: number;
  true_emv?: number;
  value_per_minute?: number;
}

export interface ReportData {
  client: MinimalClient;
  generated_at: string;
  batch_name: string;
  quarter?: string; // e.g., "Q4 2025"
  date_range?: {
    start: string; // ISO date
    end: string; // ISO date
  };
  cpm: number; // Default 50
  speaking_time_pct?: number; // Default 0.40 (40%)
  
  // Multi-speaker report fields
  report_type?: 'single' | 'multi';
  company_name?: string; // For multi-speaker reports
  selected_speaker_ids?: string[];
  speaker_breakdowns?: SpeakerBreakdown[];
  
  kpis: {
    // Existing from Batch CSV
    total_evaluated: number;
    fit_count: number;
    consider_count: number;
    not_fit_count: number;
    avg_score: number;
    total_reach: number; // Sum of monthly_listens (total show reach)
    total_listeners_per_episode?: number; // Sum of listeners_per_episode for the quarter
    total_social_reach: number;
    top_categories: Array<{ 
      name: string; 
      count: number;
      podcasts?: Array<{
        show_title: string;
        cover_art_url?: string;
        description?: string;
        apple_podcast_link?: string;
      }>;
    }>;
    
    // New from Airtable CSV
    total_interviews: number; // Count of 'podcast recording' actions in date range
    total_booked: number; // Count with date_booked
    total_published: number; // Count with date_published
    total_recorded?: number; // Count with scheduled_date_time in range
    total_intro_calls?: number; // Count of 'intro call' actions with scheduled_date_time in range
    
    // Placeholder metrics for future implementation
    total_emv?: number; // Earned Media Value (based on CPM formulas)
    sov_percentage?: number; // Share of Voice percentage
    geo_score?: number; // Generative Engine Optimization score (0-100)
  };
  
  campaign_overview: {
    strategy: string;
    executive_summary: string;
    target_audiences: string[];
    talking_points: string[];
    pitch_hooks?: Array<{
      speaker_name: string;
      hooks: string[];
    }>;
  };
  
  podcasts: PodcastReportEntry[];
  intro_call_podcasts?: PodcastReportEntry[]; // Intro call entries for dialog
  
  // Optional SOV data
  sov_analysis?: {
    client_interview_count: number; // From Airtable
    competitors: Array<{
      name: string;
      role?: string;
      peer_reason?: string;
      linkedin_url?: string;
      interview_count: number;
      episodes?: Array<{
        title: string;
        podcast_name: string;
        air_date: string;
        role: string;
      }>;
    }>;
    client_percentage: number; // Client count / total count
  };
  
  // Optional GEO data (Generative Engine Optimization)
  geo_analysis?: {
    total_podcasts_indexed: number; // Count of podcasts.apple.com entries
    unique_ai_engines: string[]; // ["perplexity", "gemini", ...]
    ai_engine_counts: Array<{ engine: string; count: number }>;
    top_prompts: Array<{ prompt: string; count: number }>;
    topic_distribution: Array<{ topic: string; count: number }>;
    geo_score: number; // 0-100 composite score
    score_breakdown: {
      ai_coverage: number; // 0-40 points
      topic_relevance: number; // 0-30 points  
      prompt_diversity: number; // 0-30 points
    };
    podcast_entries: Array<{
      title: string;
      uri: string;
      llm: string;
      prompt: string;
      topic: string;
    }>;
  };
  
  // Next Quarter Strategy (Looking Ahead)
  next_quarter_strategy?: {
    quarter: string;
    intro_paragraph: string;
    strategic_focus_areas: Array<{
      title: string;
      description: string;
    }>;
    talking_points_spotlight: Array<{
      title: string;
      description: string;
    }>;
    // Per-speaker talking points spotlight (for multi-speaker reports)
    speaker_talking_points_spotlight?: Array<{
      speaker_name: string;
      points: Array<{
        title: string;
        description: string;
      }>;
    }>;
    closing_paragraph: string;
    // Next Quarter KPIs
    next_quarter_kpis?: {
      high_impact_podcasts_goal: number; // 3 per speaker per month × 3 months
      listenership_goal: number; // Current listenership × 1.2
      // Per-speaker breakdown for expandable view
      speaker_breakdown?: Array<{
        speaker_name: string;
        goal: number; // 9 per speaker (3/month × 3 months)
      }>;
      // Current quarter actual values for listenership breakdown
      current_total_reach?: number;
      // Current quarter's estimated annual listenership for calculating goal
      current_annual_listenership?: number;
      // Manual overrides for listenership dialog (when set, these override calculations)
      monthly_listeners_per_episode_goal?: number;
      annual_listenership_goal?: number;
      growth_percentage?: number;
      current_listeners_per_episode?: number;
    };
  };
  
  // Content Gap Analysis (from Spotlight)
  content_gap_analysis?: ContentGapAnalysis;
  
// Target Podcasts for Next Quarter
target_podcasts?: TargetPodcast[];

// Flags to track if optional CSVs were provided (even if no results)
geo_csv_uploaded?: boolean;
content_gap_csv_uploaded?: boolean;

// Flag to indicate scores were generated at report time from show notes
contains_live_scores?: boolean;

// Interview Highlights (video/audio clips from published interviews)
highlight_clips?: HighlightClip[];

// Social Value Analysis
social_value_analysis?: {
  total_social_value: number;
  platform_breakdown: Array<{
    platform: string;
    cpm: number;
    value: number;
    percentage: number;
  }>;
};
}

// Highlight clip for interview showcase
export interface HighlightClip {
  id: string;
  title: string;
  podcast_name?: string;
  speaker_name?: string;
  description?: string;
  media_type: 'video' | 'audio';
  source_type: 'upload' | 'youtube' | 'vimeo' | 'descript' | 'external';
  url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  created_at: string;
}
