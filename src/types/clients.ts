
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
  campaign_manager?: string; // Campaign Manager assignment
  // Kept for backward compatibility with older seeds/forms
  campaign_strategy?: string;
}
