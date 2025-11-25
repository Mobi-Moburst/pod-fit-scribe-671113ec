// Batch CSV (from Fit Engine)
export interface BatchCSVRow {
  show_title: string;
  podcast_url?: string;
  verdict: 'Fit' | 'Consider' | 'Not';
  overall_score: number;
  listeners_per_episode?: number;
  social_reach?: number;
  categories?: string;
  rationale_short?: string;
  status: string; // 'success' or 'failed'
  metadata?: any;
}

// Airtable CSV
export interface AirtableCSVRow {
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
  peer: string; // Guest name / competitor identifier
  title: string; // Episode title
  podcast_title: string; // Podcast name
  publisher: string; // Publisher/host
  description: string;
  audio: string; // Audio URL
  pub_date: string; // Publication date
}
