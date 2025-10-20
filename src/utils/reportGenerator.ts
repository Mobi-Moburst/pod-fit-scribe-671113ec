import { MinimalClient } from '@/types/clients';
import { BatchRow } from '@/types/batch';
import { ReportData } from '@/types/reports';

export function generateReportFromCSV(
  csvData: any[],
  client: MinimalClient,
  batchName: string = 'Batch Analysis Report'
): ReportData {
  // Filter successful evaluations
  const successfulRows = csvData.filter(row => 
    row.status === 'success' && row.verdict && row.overall_score
  );

  const kpis = calculateKPIs(successfulRows);
  const podcasts = successfulRows.map(row => ({
    show_title: row.show_title || row.metadata?.name || 'Unknown',
    verdict: row.verdict as 'Fit' | 'Consider' | 'Not',
    overall_score: parseFloat(row.overall_score) || 0,
    listeners_per_episode: row.metadata?.listeners_per_episode,
    categories: row.metadata?.categories,
    rationale_short: row.rationale_short,
  })).sort((a, b) => b.overall_score - a.overall_score);

  return {
    client,
    generated_at: new Date().toISOString(),
    batch_name: batchName,
    kpis,
    campaign_overview: {
      strategy: client.campaign_strategy || '',
      target_audiences: client.target_audiences || [],
      talking_points: client.talking_points || [],
    },
    podcasts,
  };
}

export function calculateKPIs(rows: any[]): ReportData['kpis'] {
  const fit_count = rows.filter(r => r.verdict === 'Fit').length;
  const consider_count = rows.filter(r => r.verdict === 'Consider').length;
  const not_fit_count = rows.filter(r => r.verdict === 'Not').length;
  
  const scores = rows.map(r => parseFloat(r.overall_score) || 0).filter(s => s > 0);
  const avg_score = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  
  const total_reach = rows.reduce((sum, r) => {
    const listeners = r.metadata?.listeners_per_episode || 0;
    return sum + (typeof listeners === 'number' ? listeners : 0);
  }, 0);

  // Count categories
  const categoryCount = new Map<string, number>();
  rows.forEach(r => {
    const cats = r.metadata?.categories || '';
    if (cats) {
      cats.split(',').forEach((cat: string) => {
        const trimmed = cat.trim();
        if (trimmed) {
          categoryCount.set(trimmed, (categoryCount.get(trimmed) || 0) + 1);
        }
      });
    }
  });

  const top_categories = Array.from(categoryCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total_evaluated: rows.length,
    fit_count,
    consider_count,
    not_fit_count,
    avg_score: Math.round(avg_score * 10) / 10,
    total_reach,
    top_categories,
  };
}
