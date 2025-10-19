export interface BatchRow {
  id: string;
  podcast_url: string;
  show_notes_fallback?: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'retry';
  error?: string;
  
  // Rephonic metadata (preserved from CSV import)
  metadata?: {
    name?: string;
    publisher?: string;
    associated_contact?: string;
    listeners_per_episode?: number;
    monthly_listens?: number;
    categories?: string;
    social_reach?: number;
    global_rank?: string;
    engagement?: number;
    language?: string;
    status?: string;
    publishes?: string;
    website?: string;
  };
  
  // Results
  show_title?: string;
  verdict?: 'Fit' | 'Consider' | 'Not';
  overall_score?: number;
  confidence?: number;
  eligibility_class?: string;
  eligibility_action?: 'override' | 'condition' | null;
  last_publish_date?: string;
  rationale_short?: string;
  
  // Full evaluation data
  evaluation_data?: any;
  url_hash?: string;
  cache_timestamp?: number;
}

export interface BatchSession {
  id: string;
  org_id: string;
  client_id: string;
  name: string;
  description?: string;
  total_count: number;
  success_count: number;
  created_at: string;
}

export interface BatchState {
  client_id: string | null;
  rows: BatchRow[];
  processing: boolean;
  completed: number;
  total: number;
  filters: {
    min_score: 'all' | '8+' | '7+' | '6+' | '5+' | '4+';
    verdict: 'all' | 'Fit' | 'Consider' | 'Not';
    stale: boolean;
    min_listeners: 'all' | '10000+' | '5000+' | '1000+' | '500+' | '100+';
    categories: string[];
    min_engagement: 'all' | '70+' | '60+' | '50+' | '40+';
    published_within: 'all' | '30d' | '90d' | '180d' | '1y';
    min_global_rank: 'all' | '10%' | '5%' | '3%' | '2%' | '1%' | '0.5%';
  };
  selected_rows: Set<string>;
  current_page: number;
  rows_per_page: number;
}

export interface PreflightResult {
  valid_urls: string[];
  invalid_urls: { url: string; reason: string }[];
  duplicates: { url: string; count: number }[];
  total_unique: number;
}