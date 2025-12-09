export interface Competitor {
  name: string;
  role: string;
  peer_reason: string;
  interview_count?: number;
}

export interface MinimalClient {
  id: string;
  name: string;
  company?: string;
  company_url?: string;
  media_kit_url: string;
  target_audiences?: string[];
  talking_points?: string[];
  avoid?: string[];
  avoid_text?: string;
  notes?: string;
  campaign_manager?: string;
  campaign_strategy?: string;
  pitch_template?: string; // Optional custom pitch template
  title?: string; // Guest's professional title (e.g., "CEO & Founder")
  // New eligibility fields
  gender?: 'male' | 'female' | 'non_binary' | 'unspecified';
  guest_identity_tags?: string[];
  professional_credentials?: string[];
  competitors?: Competitor[];
  airtable_embed_url?: string; // Shared Airtable view URL for embedding in reports
}
