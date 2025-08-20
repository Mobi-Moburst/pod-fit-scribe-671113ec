export interface BatchRow {
  id: string;
  podcast_url: string;
  show_notes_fallback?: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'retry';
  error?: string;
  
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

export interface BatchState {
  client_id: string | null;
  rows: BatchRow[];
  processing: boolean;
  completed: number;
  total: number;
  filters: {
    min_score: number;
    verdict: 'all' | 'Fit' | 'Consider' | 'Not';
    stale: boolean;
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