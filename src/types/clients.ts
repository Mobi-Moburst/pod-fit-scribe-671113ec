
export interface MinimalClient {
  id: string;
  name: string;
  company?: string;
  media_kit_url: string;
  target_audiences?: string[];
  talking_points?: string[];
  avoid?: string[];
  notes?: string;
  // Kept for backward compatibility with older seeds/forms
  campaign_strategy?: string;
}
