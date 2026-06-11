// Batch CSV (from Fit Engine)
export interface BatchCSVRow {
  show_title: string;
  podcast_url?: string;
  verdict: 'Fit' | 'Consider' | 'Not';
  overall_score: number;
  listeners_per_episode?: number;
  monthly_listens?: number; // Total monthly listeners for the show
  social_reach?: number;
  categories?: string;
  rationale_short?: string;
  status: string; // 'success' or 'failed'
  metadata?: any;
}

// Airtable CSV
export interface AirtableCSVRow {
  record_id?: string;
  podcast_name: string;
  apple_podcast_link?: string;
  action: string; // 'podcast recording', 'intro call', 'pending reschedule'
  scheduled_date_time: string; // ISO date string or parseable format
  show_notes?: string;
  date_booked?: string;
  date_published?: string;
  link_to_episode?: string;
}

// SOV CSV (from ListenNotes)
export interface SOVCSVRow {
  title: string; // Episode title
  podcast_title: string; // Podcast name
  publisher: string; // Publisher/host
  description: string;
  audio: string; // Audio URL
  pub_date: string; // Publication date
  peer: string; // Competitor/peer name
}

// GEO CSV (from Spotlight AEO/GEO export)
export interface GEOCSVRow {
  uri: string; // URL
  title: string; // Page/podcast title
  domain: string; // e.g., "podcasts.apple.com"
  type: string; // e.g., "Homepage", "Article"
  llm: string; // AI engine: "perplexity", "gemini", "chatgpt", etc.
  prompt_text: string; // The query that surfaced this result
  topic_name: string; // Category/topic
  has_analysis: string; // "Yes" or "No"
}

// Content Gap CSV (from Spotlight Content Gap Analysis)
export interface ContentGapEngineData {
  name: string; // 'gemini', 'chatgpt', 'grok', 'copilot'
  present: boolean;
  rank?: number;
  sentiment?: string;
  mentioned_brands: string[];
}

export interface ContentGapCSVRow {
  topic: string;
  customer_journey: string; // 'awareness', 'consideration', 'decision', 'post-purchase'
  prompt: string;
  run_date: string;
  engines: ContentGapEngineData[];
}

// Rephonic EMV CSV (for manual EMV data entry)
export interface RephonicCSVRow {
  podcast_name: string;
  listeners_per_episode?: number;
  monthly_listens?: number;
  social_reach?: number;
  categories?: string;
  apple_podcast_link?: string;
  description?: string;
  publisher?: string;
  episode_duration_minutes?: number;
  episode_link?: string;
  emv?: number; // Pre-calculated EMV if provided
}
