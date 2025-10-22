import { MinimalClient } from './clients';

export interface ReportData {
  client: MinimalClient;
  generated_at: string;
  batch_name: string;
  
  kpis: {
    total_evaluated: number;
    fit_count: number;
    consider_count: number;
    not_fit_count: number;
    avg_score: number;
    total_reach: number;
    total_social_reach: number;
    top_categories: Array<{ name: string; count: number }>;
  };
  
  campaign_overview: {
    strategy: string;
    target_audiences: string[];
    talking_points: string[];
  };
  
  podcasts: Array<{
    show_title: string;
    verdict: 'Fit' | 'Consider' | 'Not';
    overall_score: number;
    listeners_per_episode?: number;
    categories?: string;
    rationale_short?: string;
  }>;
}
