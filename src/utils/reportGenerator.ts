import { MinimalClient } from '@/types/clients';
import { BatchRow } from '@/types/batch';
import { ReportData, PodcastReportEntry } from '@/types/reports';
import { BatchCSVRow, AirtableCSVRow, SOVCSVRow } from '@/types/csv';
import { pickTopAudienceTags } from '@/lib/campaignStrategy';
import { normalizeTitle } from './csvParsers';
import { supabase } from '@/integrations/supabase/client';

function generateStrategyParagraph(client: MinimalClient): string {
  const audiences = pickTopAudienceTags({
    strategyText: client.campaign_strategy,
    audiences: client.target_audiences,
    max: 3
  });
  
  const talkingPoints = client.talking_points?.slice(0, 3) || [];
  const companyName = client.company || client.name;
  const guestName = client.name;
  const title = client.title || '';
  
  // Build natural paragraph
  let paragraph = `This campaign positions ${guestName}`;
  if (title) paragraph += `, ${title}`;
  if (companyName && companyName !== guestName) paragraph += ` at ${companyName}`;
  paragraph += `, as a thought leader reaching `;
  
  if (audiences.length > 0) {
    paragraph += audiences.join(', ');
  } else {
    paragraph += 'key industry audiences';
  }
  
  paragraph += '. ';
  
  if (talkingPoints.length > 0) {
    paragraph += `Conversations focus on ${talkingPoints.join(', ').toLowerCase()}, `;
    paragraph += 'positioning the guest as an authoritative voice in the space.';
  }
  
  return paragraph;
}

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
    // Use top-level CSV fields first, fallback to metadata
    listeners_per_episode: row.listeners_per_episode || row.metadata?.listeners_per_episode,
    categories: row.categories || row.metadata?.categories,
    rationale_short: row.rationale_short,
  })).sort((a, b) => b.overall_score - a.overall_score);

  return {
    client,
    generated_at: new Date().toISOString(),
    batch_name: batchName,
    kpis,
    campaign_overview: {
      strategy: generateStrategyParagraph(client),
      target_audiences: pickTopAudienceTags({
        strategyText: client.campaign_strategy,
        audiences: client.target_audiences,
        max: 3
      }),
      talking_points: client.talking_points?.slice(0, 3) || [],
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
    // CSV has these as top-level fields, not nested in metadata
    const listeners = r.listeners_per_episode !== undefined ? r.listeners_per_episode : 0;
    const parsed = typeof listeners === 'string' ? parseFloat(listeners) : listeners;
    return sum + (typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0);
  }, 0);

  const total_social_reach = rows.reduce((sum, r) => {
    // CSV has these as top-level fields, not nested in metadata
    const social = r.social_reach !== undefined ? r.social_reach : 0;
    const parsed = typeof social === 'string' ? parseFloat(social) : social;
    return sum + (typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0);
  }, 0);

  // Count categories
  const categoryCount = new Map<string, number>();
  rows.forEach(r => {
    // Try both top-level (from CSV) and metadata (from live data)
    const cats = r.categories || r.metadata?.categories || '';
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
    total_social_reach,
    top_categories,
    total_interviews: 0,
    total_booked: 0,
    total_published: 0,
  };
}

// Helper to validate URL
function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// Batch scrape episode durations
async function batchScrapeDurations(
  podcasts: PodcastReportEntry[]
): Promise<PodcastReportEntry[]> {
  const scrapeTasks = podcasts.map(async (podcast) => {
    // Skip if no episode link or invalid URL
    if (!podcast.episode_link || !isValidUrl(podcast.episode_link)) {
      return {
        ...podcast,
        duration_scraped: false,
      };
    }
    
    try {
      const { data, error } = await supabase.functions.invoke(
        'scrape-episode-duration',
        { body: { url: podcast.episode_link } }
      );
      
      if (error || !data?.success) {
        console.warn(`Failed to scrape duration for ${podcast.show_title}:`, error);
        return {
          ...podcast,
          duration_scraped: false,
        };
      }
      
      return {
        ...podcast,
        episode_duration_minutes: data.duration_minutes,
        duration_scraped: true,
      };
    } catch (err) {
      console.error(`Error scraping ${podcast.show_title}:`, err);
      return {
        ...podcast,
        duration_scraped: false,
      };
    }
  });
  
  return Promise.all(scrapeTasks);
}

// Merge Batch + Airtable by podcast title
function mergePodcastData(
  batchRows: BatchCSVRow[],
  airtableRows: AirtableCSVRow[]
): PodcastReportEntry[] {
  const successfulBatch = batchRows.filter(row => 
    row.status === 'success' && row.verdict && row.overall_score
  );
  
  // Create lookup map for Airtable data
  const airtableMap = new Map<string, AirtableCSVRow>();
  airtableRows.forEach(row => {
    const normalized = normalizeTitle(row.podcast_name);
    airtableMap.set(normalized, row);
  });
  
  // Merge data
  return successfulBatch.map(batchRow => {
    const normalizedTitle = normalizeTitle(batchRow.show_title);
    const airtableRow = airtableMap.get(normalizedTitle);
    
    return {
      // Batch data
      show_title: batchRow.show_title,
      verdict: batchRow.verdict,
      overall_score: parseFloat(String(batchRow.overall_score)) || 0,
      listeners_per_episode: batchRow.listeners_per_episode,
      social_reach: batchRow.social_reach,
      categories: batchRow.categories,
      rationale_short: batchRow.rationale_short,
      
      // Airtable data (if matched)
      apple_podcast_link: airtableRow?.apple_podcast_link,
      action: airtableRow?.action,
      scheduled_date_time: airtableRow?.scheduled_date_time,
      show_notes: airtableRow?.show_notes,
      date_booked: airtableRow?.date_booked,
      date_published: airtableRow?.date_published,
      episode_link: airtableRow?.link_to_episode,
    };
  });
}

// Calculate enhanced KPIs from Batch + Airtable
function calculateEnhancedKPIs(
  batchRows: BatchCSVRow[],
  airtableRows: AirtableCSVRow[]
): ReportData['kpis'] {
  const successfulBatch = batchRows.filter(row => 
    row.status === 'success' && row.verdict && row.overall_score
  );
  
  // Existing batch KPIs
  const fit_count = successfulBatch.filter(r => r.verdict === 'Fit').length;
  const consider_count = successfulBatch.filter(r => r.verdict === 'Consider').length;
  const not_fit_count = successfulBatch.filter(r => r.verdict === 'Not').length;
  
  const scores = successfulBatch.map(r => parseFloat(String(r.overall_score)) || 0);
  const avg_score = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  
  const total_reach = successfulBatch.reduce((sum, r) => {
    const listeners = r.listeners_per_episode || 0;
    const parsed = typeof listeners === 'string' ? parseFloat(listeners) : listeners;
    return sum + (typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0);
  }, 0);
  
  const total_social_reach = successfulBatch.reduce((sum, r) => {
    const social = r.social_reach || 0;
    const parsed = typeof social === 'string' ? parseFloat(social) : social;
    return sum + (typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0);
  }, 0);
  
  // Calculate top categories
  const categoryCount = new Map<string, number>();
  successfulBatch.forEach(r => {
    if (r.categories) {
      const cats = r.categories.split(',').map(c => c.trim());
      cats.forEach(cat => {
        if (cat) categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
      });
    }
  });
  
  const top_categories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  
  // New Airtable KPIs
  const total_interviews = airtableRows.filter(r => 
    r.action?.toLowerCase().includes('podcast recording')
  ).length;
  
  const total_booked = airtableRows.filter(r => 
    r.date_booked && r.date_booked.trim() !== ''
  ).length;
  
  const total_published = airtableRows.filter(r => 
    r.date_published && r.date_published.trim() !== ''
  ).length;
  
  return {
    total_evaluated: successfulBatch.length,
    fit_count,
    consider_count,
    not_fit_count,
    avg_score: Math.round(avg_score * 10) / 10,
    total_reach,
    total_social_reach,
    top_categories,
    total_interviews,
    total_booked,
    total_published,
  };
}

// Calculate SOV analysis
function calculateSOVAnalysis(
  airtableRows: AirtableCSVRow[],
  sovRows: SOVCSVRow[],
  competitorName: string | null
): ReportData['sov_analysis'] {
  const clientCount = airtableRows.filter(r => 
    r.action?.toLowerCase().includes('podcast recording')
  ).length;
  
  const competitorCount = sovRows.length;
  const totalCount = clientCount + competitorCount;
  
  return {
    client_interview_count: clientCount,
    competitors: [
      {
        name: competitorName || 'Industry Average',
        interview_count: competitorCount,
      }
    ],
    client_percentage: totalCount > 0 
      ? Math.round((clientCount / totalCount) * 100) 
      : 0,
  };
}

// New function for multi-CSV report generation
export async function generateReportFromMultipleCSVs(
  batchRows: BatchCSVRow[],
  airtableRows: AirtableCSVRow[],
  sovRows: SOVCSVRow[] | null,
  sovCompetitorName: string | null,
  client: MinimalClient,
  reportName: string,
  quarter: string,
  dateRange: { start: Date; end: Date }
): Promise<ReportData> {
  
  // Step 1: Merge Batch + Airtable data by podcast title
  const mergedPodcasts = mergePodcastData(batchRows, airtableRows);
  
  // Step 2: Batch scrape episode durations
  const podcastsWithDuration = await batchScrapeDurations(mergedPodcasts);
  
  // Step 3: Calculate enhanced KPIs
  const kpis = calculateEnhancedKPIs(batchRows, airtableRows);
  
  // Step 4: Calculate SOV if provided
  const sov_analysis = sovRows 
    ? calculateSOVAnalysis(airtableRows, sovRows, sovCompetitorName)
    : undefined;
  
  // Step 5: Sort podcasts by score
  const sortedPodcasts = podcastsWithDuration.sort((a, b) => 
    b.overall_score - a.overall_score
  );
  
  return {
    client,
    generated_at: new Date().toISOString(),
    batch_name: reportName,
    quarter,
    date_range: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
    kpis,
    campaign_overview: {
      strategy: generateStrategyParagraph(client),
      target_audiences: pickTopAudienceTags({
        strategyText: client.campaign_strategy,
        audiences: client.target_audiences,
        max: 3
      }),
      talking_points: client.talking_points?.slice(0, 3) || [],
    },
    podcasts: sortedPodcasts,
    sov_analysis,
  };
}
