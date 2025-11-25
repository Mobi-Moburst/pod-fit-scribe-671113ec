import { MinimalClient } from './clients';

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
  
  // Future Phase 2: CPM calculations
  base_emv?: number;
  true_emv?: number;
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
}
