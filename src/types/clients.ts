
export interface MinimalClient {
  id: string;
  name: string;
  company?: string;
  media_kit_url: string;
  target_audiences?: string[];
  talking_points?: string[];
  avoid?: string[];
  avoid_text?: string;
  notes?: string;
  campaign_manager?: string;
  campaign_strategy?: string;
  // New eligibility fields
  gender?: 'male' | 'female' | 'non_binary' | 'unspecified';
  guest_identity_tags?: string[];
  professional_credentials?: string[];
}
