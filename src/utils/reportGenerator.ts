import Papa from 'papaparse';

export interface ReportData {
  report_meta: {
    client_name: string;
    company: string;
    period: string;
    batch_name: string;
    generated_at: string;
  };
  kpis: {
    total_evaluated: number;
    mean_fit_score: number;
    median_fit_score: number;
    mean_confidence: number;
  };
  visual_blocks: {
    kpi_strip: {
      enabled: boolean;
      data: {
        total_evaluated: number;
        mean_fit_score: number;
        median_fit_score: number;
        mean_confidence: number;
      };
    };
    funnel_bars: {
      enabled: boolean;
      data: {
        qualified: { count: number; percentage: string };
        consider: { count: number; percentage: string };
        not_fit: { count: number; percentage: string };
      };
    };
    score_distribution: {
      enabled: boolean;
      data: Array<{ bucket: string; count: number }>;
    };
    category_heatmap: {
      enabled: boolean;
      data: Array<{
        category: string;
        avg_score: number;
        count: number;
        total_reach: number;
        color_intensity: number;
      }>;
    };
    fit_vs_reach_matrix: {
      enabled: boolean;
      data: Array<{
        show_title: string;
        fit_score: number;
        reach: number;
        engagement: number;
        url: string;
      }>;
    };
  };
  notable_episodes: Array<{
    show_title: string;
    fit_score: number;
    reach: number;
    engagement: number;
    url: string;
  }>;
  hidden_gems: Array<{
    show_title: string;
    fit_score: number;
    reach: number;
    summary: string;
    url: string;
  }>;
}

interface CSVRow {
  podcast_url: string;
  show_title?: string;
  overall_score?: string;
  confidence?: string;
  verdict?: string;
  last_publish_date?: string;
  rationale_short?: string;
  [key: string]: any; // For metadata fields
}

export interface VisualToggles {
  kpi_strip: boolean;
  funnel_bars: boolean;
  score_distribution: boolean;
  category_heatmap: boolean;
  fit_vs_reach_matrix: boolean;
}

// Helper functions
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

function parseCategories(categoriesStr: string | undefined): string[] {
  if (!categoriesStr) return [];
  // Handle comma-separated or semicolon-separated
  return categoriesStr.split(/[,;]/).map(c => c.trim()).filter(Boolean);
}

export async function generateReportFromCSV(
  csvFile: File,
  clientName: string,
  company: string,
  batchName: string,
  period: string,
  visualToggles: VisualToggles
): Promise<ReportData> {
  // Parse CSV
  const csvText = await csvFile.text();
  const parseResult = Papa.parse<CSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    throw new Error(`CSV parsing error: ${parseResult.errors[0].message}`);
  }

  const rows = parseResult.data;
  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Filter out rows without scores (pending/error rows)
  const validRows = rows.filter(row => 
    row.overall_score && parseNumber(row.overall_score) > 0
  );

  if (validRows.length === 0) {
    throw new Error('No valid evaluations found in CSV');
  }

  // Calculate KPIs
  const scores = validRows.map(r => parseNumber(r.overall_score));
  const confidences = validRows.map(r => parseNumber(r.confidence));
  
  const kpis = {
    total_evaluated: validRows.length,
    mean_fit_score: mean(scores),
    median_fit_score: median(scores),
    mean_confidence: mean(confidences),
  };

  // Generate funnel data
  const qualified = validRows.filter(r => parseNumber(r.overall_score) >= 8).length;
  const consider = validRows.filter(r => {
    const score = parseNumber(r.overall_score);
    return score >= 6 && score < 8;
  }).length;
  const not_fit = validRows.filter(r => parseNumber(r.overall_score) < 6).length;
  const total = validRows.length;

  const funnelData = {
    qualified: {
      count: qualified,
      percentage: ((qualified / total) * 100).toFixed(1),
    },
    consider: {
      count: consider,
      percentage: ((consider / total) * 100).toFixed(1),
    },
    not_fit: {
      count: not_fit,
      percentage: ((not_fit / total) * 100).toFixed(1),
    },
  };

  // Generate score distribution
  const buckets = ['0-1', '1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9', '9-10'];
  const distributionData = buckets.map(bucket => {
    const [min, max] = bucket.split('-').map(Number);
    const count = validRows.filter(r => {
      const score = parseNumber(r.overall_score);
      return score >= min && score < max;
    }).length;
    return { bucket, count };
  });

  // Generate category heatmap
  const categoryMap = new Map<string, { scores: number[]; reaches: number[] }>();
  
  validRows.forEach(row => {
    const categories = parseCategories(row.categories || row.Categories);
    const score = parseNumber(row.overall_score);
    const reach = parseNumber(row.listeners_per_episode || row['Listeners Per Episode']);
    
    if (categories.length === 0) {
      categories.push('Uncategorized');
    }
    
    categories.forEach(category => {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { scores: [], reaches: [] });
      }
      const data = categoryMap.get(category)!;
      data.scores.push(score);
      data.reaches.push(reach);
    });
  });

  const categoryData = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      avg_score: mean(data.scores),
      count: data.scores.length,
      total_reach: data.reaches.reduce((a, b) => a + b, 0),
      color_intensity: mean(data.scores) / 10,
    }))
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, 15); // Top 15 categories

  // Select notable episodes (top 10 by score with decent reach)
  const notableEpisodes = validRows
    .map(row => ({
      show_title: row.show_title || 'Untitled',
      fit_score: parseNumber(row.overall_score),
      reach: parseNumber(row.listeners_per_episode || row['Listeners Per Episode']),
      engagement: parseNumber(row.engagement || row.Engagement),
      url: row.podcast_url,
    }))
    .filter(ep => ep.reach > 1000) // At least 1k listeners
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 10);

  // Identify hidden gems (high score, lower reach)
  const hiddenGems = validRows
    .map(row => ({
      show_title: row.show_title || 'Untitled',
      fit_score: parseNumber(row.overall_score),
      reach: parseNumber(row.listeners_per_episode || row['Listeners Per Episode']),
      summary: row.rationale_short || 'Strong fit with growth potential',
      url: row.podcast_url,
    }))
    .filter(ep => ep.fit_score >= 7.5 && ep.reach < 10000 && ep.reach > 100)
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 5);

  // Build fit vs reach matrix data
  const matrixData = validRows
    .map(row => ({
      show_title: row.show_title || 'Untitled',
      fit_score: parseNumber(row.overall_score),
      reach: parseNumber(row.listeners_per_episode || row['Listeners Per Episode']),
      engagement: parseNumber(row.engagement || row.Engagement),
      url: row.podcast_url,
    }))
    .filter(ep => ep.reach > 0); // Only include rows with reach data

  // Assemble final report
  const reportData: ReportData = {
    report_meta: {
      client_name: clientName,
      company: company,
      period: period,
      batch_name: batchName,
      generated_at: new Date().toISOString(),
    },
    kpis,
    visual_blocks: {
      kpi_strip: {
        enabled: visualToggles.kpi_strip,
        data: kpis,
      },
      funnel_bars: {
        enabled: visualToggles.funnel_bars,
        data: funnelData,
      },
      score_distribution: {
        enabled: visualToggles.score_distribution,
        data: distributionData,
      },
      category_heatmap: {
        enabled: visualToggles.category_heatmap,
        data: categoryData,
      },
      fit_vs_reach_matrix: {
        enabled: visualToggles.fit_vs_reach_matrix,
        data: matrixData,
      },
    },
    notable_episodes: notableEpisodes,
    hidden_gems: hiddenGems,
  };

  return reportData;
}
