export interface Competitor {
  name: string;
  role: string;
  peer_reason: string;
  interview_count?: number;
}

// Brand colors structure from Firecrawl
export interface BrandColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  textPrimary?: string;
  textSecondary?: string;
}

// New Company type (company-level fields)
export interface Company {
  id: string;
  name: string;
  company_url?: string;
  logo_url?: string;
  brand_colors?: BrandColors;
  campaign_manager?: string;
  airtable_embed_url?: string;
  product_type?: string;
  tags?: string[];
  notes?: string;
}

// New Speaker type (speaker-level fields)
export interface Speaker {
  id: string;
  company_id: string;
  name: string;
  title?: string;
  media_kit_url?: string;
  gender?: 'male' | 'female' | 'non_binary' | 'unspecified';
  target_audiences?: string[];
  talking_points?: string[];
  avoid?: string[];
  guest_identity_tags?: string[];
  professional_credentials?: string[];
  campaign_strategy?: string;
  pitch_template?: string;
  competitors?: Competitor[];
}

// Combined view for reports and UI convenience
export interface SpeakerWithCompany extends Speaker {
  company: Company;
}

/**
 * @deprecated Use Company and Speaker types instead. Will be removed after Phase E migration.
 */
export interface MinimalClient {
  id: string;
  name: string;
  company?: string;
  company_url?: string;
  logo_url?: string;
  brand_colors?: BrandColors;
  media_kit_url: string;
  target_audiences?: string[];
  talking_points?: string[];
  avoid?: string[];
  avoid_text?: string;
  notes?: string;
  campaign_manager?: string;
  campaign_strategy?: string;
  pitch_template?: string;
  title?: string;
  gender?: 'male' | 'female' | 'non_binary' | 'unspecified';
  guest_identity_tags?: string[];
  professional_credentials?: string[];
  competitors?: Competitor[];
  airtable_embed_url?: string;
}
