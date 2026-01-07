import { ReportData } from "@/types/reports";

export interface NextQuarterKpisResult {
  high_impact_podcasts_goal: number;
  
  // Total Listenership (Monthly) - sum of all monthly listeners from booked podcasts
  total_listenership_goal: number; // 20% increase from current
  current_total_listenership: number; // Baseline = kpis.total_reach
  
  // Est. Annual Listenership - monthly listeners per episode × 12
  est_annual_listenership_goal: number; // 20% increase from current
  current_est_annual_listenership: number; // Baseline = kpis.total_listeners_per_episode × 12
  
  // Speaker breakdown for high-impact podcasts
  speaker_breakdown: Array<{
    speaker_name: string;
    goal: number; // 9 per speaker (3/month × 3 months)
  }>;
}

/**
 * Calculate next quarter KPIs based on current quarter's report data.
 * 
 * Two distinct listenership metrics:
 * 1. Total Listenership (Monthly): Sum of all monthly listeners from booked podcasts
 *    - Baseline: kpis.total_reach (e.g., 132,244)
 *    - Goal: baseline × 1.2 (e.g., 158,693)
 * 
 * 2. Est. Annual Listenership: Monthly listeners per episode projected over a year
 *    - Baseline: kpis.total_listeners_per_episode × 12 (e.g., 9,803 × 12 = 117,636)
 *    - Goal: baseline × 1.2 (e.g., 141,163)
 */
export function calculateNextQuarterKpis(
  kpis: ReportData["kpis"],
  speakerCount: number = 1,
  speakerNames: string[] = []
): NextQuarterKpisResult {
  // High impact podcasts: 3 per speaker per month × 3 months
  const high_impact_podcasts_goal = 3 * speakerCount * 3;

  // Total Listenership (Monthly) - from total_reach
  const current_total_listenership = kpis.total_reach || 0;
  const total_listenership_goal = Math.round(current_total_listenership * 1.2);

  // Est. Annual Listenership - from total_listeners_per_episode × 12
  const monthlyListenersPerEpisode = kpis.total_listeners_per_episode || 0;
  const current_est_annual_listenership = Math.round(monthlyListenersPerEpisode * 12);
  const est_annual_listenership_goal = Math.round(current_est_annual_listenership * 1.2);

  // Build speaker breakdown (9 podcasts per speaker = 3/month × 3 months)
  const speaker_breakdown = speakerNames.length > 0
    ? speakerNames.map(name => ({ speaker_name: name, goal: 9 }))
    : [{ speaker_name: "Speaker", goal: 9 }];

  return {
    high_impact_podcasts_goal,
    total_listenership_goal,
    current_total_listenership,
    est_annual_listenership_goal,
    current_est_annual_listenership,
    speaker_breakdown,
  };
}

/**
 * Migrate/populate next_quarter_kpis for existing reports.
 * Fills in missing fields while preserving manually-edited goals.
 */
export function migrateNextQuarterKpis(
  existingKpis: ReportData["next_quarter_strategy"]["next_quarter_kpis"] | undefined,
  kpis: ReportData["kpis"],
  speakerCount: number = 1,
  speakerNames: string[] = []
): NextQuarterKpisResult {
  const calculated = calculateNextQuarterKpis(kpis, speakerCount, speakerNames);

  if (!existingKpis) {
    return calculated;
  }

  // Migrate from old field names if they exist
  // Old: listenership_goal, current_total_reach (was used for est annual listenership)
  // New: est_annual_listenership_goal, current_est_annual_listenership
  const legacyEstAnnualGoal = (existingKpis as any).listenership_goal;
  const legacyEstAnnualBaseline = (existingKpis as any).current_total_reach;

  return {
    high_impact_podcasts_goal: existingKpis.high_impact_podcasts_goal || calculated.high_impact_podcasts_goal,
    
    // Total Listenership (Monthly) - new field, always calculate
    total_listenership_goal: (existingKpis as any).total_listenership_goal || calculated.total_listenership_goal,
    current_total_listenership: (existingKpis as any).current_total_listenership || calculated.current_total_listenership,
    
    // Est. Annual Listenership - migrate from legacy fields if present, otherwise calculate
    est_annual_listenership_goal: (existingKpis as any).est_annual_listenership_goal || legacyEstAnnualGoal || calculated.est_annual_listenership_goal,
    current_est_annual_listenership: (existingKpis as any).current_est_annual_listenership || legacyEstAnnualBaseline || calculated.current_est_annual_listenership,
    
    speaker_breakdown: existingKpis.speaker_breakdown || calculated.speaker_breakdown,
  };
}
