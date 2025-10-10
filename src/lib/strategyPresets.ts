export type StrategyPreset = 'audience-first' | 'brand-sensitive' | 'icp-strict-abm';

export interface StrategyWeights {
  topic: number;
  icp: number;
  brand: number;
}

export const STRATEGY_PRESETS: Record<StrategyPreset, { 
  label: string; 
  description: string; 
  weights: StrategyWeights;
  color: string;
}> = {
  'audience-first': {
    label: 'Audience-First',
    description: 'Prioritizes topic relevance and audience alignment equally',
    weights: { topic: 0.45, icp: 0.45, brand: 0.10 },
    color: 'bg-blue-500',
  },
  'brand-sensitive': {
    label: 'Brand-Sensitive',
    description: 'Balances content fit with brand quality concerns',
    weights: { topic: 0.40, icp: 0.40, brand: 0.20 },
    color: 'bg-purple-500',
  },
  'icp-strict-abm': {
    label: 'ICP-Strict ABM',
    description: 'Heavily weights audience match for account-based campaigns',
    weights: { topic: 0.35, icp: 0.55, brand: 0.10 },
    color: 'bg-emerald-500',
  },
};
