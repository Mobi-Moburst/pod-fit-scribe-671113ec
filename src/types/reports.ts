import { MinimalClient } from './clients';

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

export interface PodcastReportEntry {
  // From Batch CSV
  show_title: string;
  verdict: 'Fit' | 'Consider' | 'Not';
  overall_score: number;
  listeners_per_episode?: number;
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
  
  kpis: {
    // Existing from Batch CSV
    total_evaluated: number;
    fit_count: number;
    consider_count: number;
    not_fit_count: number;
    avg_score: number;
    total_reach: number;
    total_social_reach: number;
    top_categories: Array<{ name: string; count: number }>;
    
    // New from Airtable CSV
    total_interviews: number; // Count of 'podcast recording' actions in date range
    total_booked: number; // Count with date_booked
    total_published: number; // Count with date_published
    
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
  };
  
  podcasts: PodcastReportEntry[];
  
  // Optional SOV data
  sov_analysis?: {
    client_interview_count: number; // From Airtable
    competitors: Array<{
      name: string; // Extracted from CSV filename or metadata
      interview_count: number;
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
    closing_paragraph: string;
  };
  
  // Content Gap Analysis (from Spotlight)
  content_gap_analysis?: ContentGapAnalysis;
}
