import { MinimalClient, Speaker, Company } from '@/types/clients';
import { BatchRow } from '@/types/batch';
import { ReportData, PodcastReportEntry, ContentGapAnalysis, SpeakerBreakdown } from '@/types/reports';
import { BatchCSVRow, AirtableCSVRow, SOVCSVRow, GEOCSVRow, ContentGapCSVRow, RephonicCSVRow } from '@/types/csv';
import { pickTopAudienceTags } from '@/lib/campaignStrategy';
import { normalizeTitle, parseAirtableDate, titlesMatch } from './csvParsers';
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

// Format numbers with K/M suffix for readability
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// Derive topic space from actual podcast categories (from batch CSV)
function deriveTopicSpaceFromCategories(kpis: ReportData['kpis']): string {
  const topCategories = kpis.top_categories || [];
  
  if (topCategories.length === 0) {
    return 'industry thought leadership';
  }
  
  // Get top 1-2 categories and format them naturally
  const topNames = topCategories
    .slice(0, 2)
    .map(c => c.name.toLowerCase().replace(/\s*podcasts?\s*/gi, '').trim());
  
  if (topNames.length === 0) {
    return 'industry thought leadership';
  }
  
  // Join with "and" for natural phrasing
  if (topNames.length === 1) {
    return topNames[0];
  }
  
  return `${topNames[0]} and ${topNames[1]}`;
}

// Generate executive summary with KPI references
function generateExecutiveSummary(
  client: MinimalClient,
  kpis: ReportData['kpis'],
  quarter: string
): string {
  const { total_booked, total_published, total_reach, total_social_reach, avg_score } = kpis;
  const pronoun = client.gender === 'female' ? 'her' : client.gender === 'male' ? 'his' : 'their';
  const topicSpace = deriveTopicSpaceFromCategories(kpis);
  
  let summary = `In ${quarter}, our podcast campaign for ${client.name}`;
  if (client.company && client.company !== client.name) {
    summary += ` and ${client.company}`;
  }
  summary += ` focused on elevating ${pronoun} presence on prominent podcasts in the ${topicSpace} space. `;
  
  // Bookings/Published sentence
  if (total_booked > 0 || total_published > 0) {
    summary += `We secured ${total_booked} podcast booking${total_booked !== 1 ? 's' : ''} this quarter`;
    
    if (total_published > 0) {
      summary += ` with ${total_published} episode${total_published !== 1 ? 's' : ''} now live`;
    }
    
    if (total_reach > 0) {
      summary += `, collectively reaching an estimated ${formatNumber(total_reach)} monthly listeners`;
    }
    
    if (total_social_reach > 0) {
      summary += ` with potential amplification to ~${formatNumber(total_social_reach)} through host and show social platforms`;
    }
    
    summary += '. ';
  }
  
  // Score insight
  if (avg_score >= 7.5) {
    summary += `These placements achieved a strong average fit score of ${avg_score.toFixed(1)}, ensuring both audience alignment and meaningful brand visibility.`;
  } else if (avg_score >= 6.0) {
    summary += `These placements reflected strategic targeting to reach the right audiences and maximize brand visibility.`;
  } else if (total_booked > 0) {
    summary += `Importantly, these placements ensure meaningful brand visibility in ${pronoun} target market.`;
  }
  
  return summary;
}

// Calculate next quarter from current quarter string (e.g., "Q3 2025" -> "Q4 2025")
function getNextQuarter(currentQuarter: string): string {
  const match = currentQuarter.match(/Q(\d)\s*(\d{4})/);
  if (!match) {
    // Default to next quarter from current date
    const now = new Date();
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    const nextQ = currentQ === 4 ? 1 : currentQ + 1;
    const nextYear = currentQ === 4 ? now.getFullYear() + 1 : now.getFullYear();
    return `Q${nextQ} ${nextYear}`;
  }
  
  const quarterNum = parseInt(match[1]);
  const year = parseInt(match[2]);
  
  if (quarterNum === 4) {
    return `Q1 ${year + 1}`;
  }
  return `Q${quarterNum + 1} ${year}`;
}

// Generate strategic focus area description based on audience type
function generateFocusDescription(audience: string, clientName: string): string {
  const audienceLower = audience.toLowerCase();
  
  if (audienceLower.includes('founder') || audienceLower.includes('entrepreneur')) {
    return `Double down on securing placements with high-visibility founder shows that expand ${clientName}'s reach into the broader startup and business leadership space.`;
  }
  if (audienceLower.includes('ai') || audienceLower.includes('tech')) {
    return `Target shows focused on applied AI and technology innovation, especially as organizations seek practical frameworks for leveraging AI effectively.`;
  }
  if (audienceLower.includes('sales') || audienceLower.includes('revenue')) {
    return `Pursue sales and revenue-focused podcasts to position ${clientName} as a go-to voice on growth strategies and business development.`;
  }
  if (audienceLower.includes('marketing') || audienceLower.includes('brand')) {
    return `Secure placements on marketing and brand strategy podcasts to amplify ${clientName}'s expertise in audience engagement and brand building.`;
  }
  if (audienceLower.includes('leadership') || audienceLower.includes('executive')) {
    return `Continue to leverage ${clientName}'s leadership perspective to secure high-profile executive and management podcasts.`;
  }
  if (audienceLower.includes('small business') || audienceLower.includes('smb')) {
    return `Expand presence on small business podcasts serving operators seeking efficiency, growth, and operational excellence.`;
  }
  if (audienceLower.includes('health') || audienceLower.includes('wellness')) {
    return `Target health and wellness shows to position ${clientName} as an authority in the wellness and lifestyle space.`;
  }
  
  // Default
  return `Continue building presence on ${audience.toLowerCase()} podcasts to expand ${clientName}'s thought leadership reach.`;
}

// Generate talking point spotlight description
function generateTalkingPointDescription(talkingPoint: string): string {
  // Extract key themes and create a strategic framing
  const pointLower = talkingPoint.toLowerCase();
  
  if (pointLower.includes('ai') || pointLower.includes('automation')) {
    return `Emphasize practical AI applications and automation strategies that give hosts actionable insights to share with their audiences.`;
  }
  if (pointLower.includes('growth') || pointLower.includes('scale')) {
    return `Highlight growth frameworks and scaling strategies that resonate with ambitious audiences seeking proven playbooks.`;
  }
  if (pointLower.includes('leadership') || pointLower.includes('team')) {
    return `Position leadership insights as a bridge between team challenges and organizational success.`;
  }
  if (pointLower.includes('product') || pointLower.includes('launch')) {
    return `Frame product updates and launches as timely news hooks that create urgency for podcast hosts.`;
  }
  
  // Default - create a generic but useful description
  return `Emphasize this topic to give hosts practical, shareable insights that resonate with their audience.`;
}

// Generate next quarter strategy section
function generateNextQuarterStrategy(
  client: MinimalClient,
  kpis: ReportData['kpis'],
  currentQuarter: string
): ReportData['next_quarter_strategy'] {
  const nextQuarter = getNextQuarter(currentQuarter);
  const topicSpace = deriveTopicSpaceFromCategories(kpis);
  const pronoun = client.gender === 'female' ? 'her' : client.gender === 'male' ? 'his' : 'their';
  const firstName = client.name.split(' ')[0];
  
  // Generate intro paragraph
  const intro_paragraph = `As we move into ${nextQuarter}, our focus is on building on the momentum of ${currentQuarter} by targeting larger, more prominent podcasts in the ${topicSpace} space — continuing to position ${firstName} as a go-to voice on ${client.talking_points?.[0]?.toLowerCase() || 'industry thought leadership'}.`;
  
  // Generate strategic focus areas from target audiences (top 3)
  const audiences = client.target_audiences?.slice(0, 3) || [];
  const strategic_focus_areas = audiences.map(audience => ({
    title: audience.replace(/podcasts?/gi, '').trim() || audience,
    description: generateFocusDescription(audience, firstName)
  }));
  
  // If no audiences, create default focus areas
  if (strategic_focus_areas.length === 0) {
    strategic_focus_areas.push({
      title: 'Industry Podcasts',
      description: `Continue securing placements on high-visibility shows that expand ${firstName}'s reach into ${pronoun} target market.`
    });
  }
  
  // Generate talking points spotlight from client talking points (top 3)
  const talkingPoints = client.talking_points?.slice(0, 3) || [];
  const talking_points_spotlight = talkingPoints.map(point => ({
    title: point.length > 40 ? point.substring(0, 40) + '...' : point,
    description: generateTalkingPointDescription(point)
  }));
  
  // If no talking points, create default
  if (talking_points_spotlight.length === 0) {
    talking_points_spotlight.push({
      title: 'Core Expertise',
      description: `Emphasize ${firstName}'s unique perspective and expertise to create compelling conversations.`
    });
  }
  
  // Generate closing paragraph
  const companyMention = client.company && client.company !== client.name 
    ? ` while keeping ${client.company}'s mission front and center`
    : '';
  const closing_paragraph = `By amplifying these themes on ${topicSpace} podcasts, we'll continue to increase ${firstName}'s visibility with the right audiences${companyMention} in the broader conversation about ${topicSpace}.`;
  
  return {
    quarter: nextQuarter,
    intro_paragraph,
    strategic_focus_areas,
    talking_points_spotlight,
    closing_paragraph
  };
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
    cpm: 50,
    kpis,
    campaign_overview: {
      strategy: generateStrategyParagraph(client),
      executive_summary: '', // Not available for single CSV reports
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

// Calculate EMV for a single podcast
function calculateEMV(
  podcast: PodcastReportEntry,
  cpm: number = 50
): {
  base_emv: number;
  speaking_minutes: number;
  ad_units: number;
  true_emv: number;
  value_per_minute: number;
} | null {
  // Require both listeners and duration
  if (!podcast.listeners_per_episode || !podcast.episode_duration_minutes) {
    return null;
  }

  const listeners = podcast.listeners_per_episode;
  const duration = podcast.episode_duration_minutes;

  // Formula: Base EMV = (listeners / 1000) * CPM
  const base_emv = (listeners / 1000) * cpm;
  
  // Speaking time: 40% of episode duration
  const speaking_minutes = duration * 0.40;
  
  // Ad units: one ad per minute of speaking time
  const ad_units = speaking_minutes;
  
  // True EMV: Base EMV × Ad Units
  const true_emv = base_emv * ad_units;
  
  // Value per minute: Base EMV
  const value_per_minute = base_emv;

  return {
    base_emv,
    speaking_minutes,
    ad_units,
    true_emv,
    value_per_minute
  };
}

// Apply EMV calculations to all podcasts
function applyEMVCalculations(
  podcasts: PodcastReportEntry[],
  cpm: number = 50
): PodcastReportEntry[] {
  return podcasts.map(podcast => {
    const emvData = calculateEMV(podcast, cpm);
    
    if (emvData) {
      return {
        ...podcast,
        ...emvData
      };
    }
    
    return podcast;
  });
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

// Find matching Airtable row using exact or partial title matching
function findAirtableMatch(
  batchTitle: string,
  airtableRows: AirtableCSVRow[]
): AirtableCSVRow | undefined {
  const normalizedBatch = normalizeTitle(batchTitle);
  
  // First try exact match
  const exactMatch = airtableRows.find(row => 
    normalizeTitle(row.podcast_name) === normalizedBatch
  );
  if (exactMatch) return exactMatch;
  
  // Then try partial/prefix match
  const partialMatch = airtableRows.find(row => 
    titlesMatch(batchTitle, row.podcast_name)
  );
  if (partialMatch) {
    console.log('[findAirtableMatch] Partial match found:', {
      batchTitle,
      airtableName: partialMatch.podcast_name,
    });
  }
  return partialMatch;
}

// Merge Batch + Airtable by podcast title
function mergePodcastData(
  batchRows: BatchCSVRow[],
  airtableRows: AirtableCSVRow[]
): PodcastReportEntry[] {
  // Filter for successful batch rows - treat missing status as valid
  const successfulBatch = batchRows.filter(row => 
    (!row.status || row.status === 'success') && row.verdict && row.overall_score
  );
  
  // Debug logging
  const uniqueStatuses = new Set(batchRows.map(row => row.status));
  console.log('[mergePodcastData] Filtering batch rows:', {
    totalBatchRows: batchRows.length,
    successfulBatchRows: successfulBatch.length,
    uniqueStatuses: Array.from(uniqueStatuses),
    sampleSuccessful: successfulBatch.slice(0, 3).map(r => ({
      title: r.show_title,
      status: r.status,
      verdict: r.verdict,
      score: r.overall_score,
    })),
  });
  
  const merged: PodcastReportEntry[] = [];
  const processedAirtableTitles = new Set<string>();
  const processedBatchTitles = new Set<string>();
  
  // First, process all batch rows with Airtable matches (exact or partial)
  successfulBatch.forEach(batchRow => {
    const normalizedBatchTitle = normalizeTitle(batchRow.show_title);
    processedBatchTitles.add(normalizedBatchTitle);
    
    // Find matching Airtable row (exact or partial)
    const airtableRow = findAirtableMatch(batchRow.show_title, airtableRows);
    
    if (airtableRow) {
      processedAirtableTitles.add(normalizeTitle(airtableRow.podcast_name));
    }
    
    merged.push({
      show_title: batchRow.show_title,
      verdict: batchRow.verdict,
      overall_score: parseFloat(String(batchRow.overall_score)) || 0,
      listeners_per_episode: batchRow.listeners_per_episode,
      monthly_listens: batchRow.monthly_listens,
      social_reach: batchRow.social_reach,
      categories: batchRow.categories,
      rationale_short: batchRow.rationale_short,
      apple_podcast_link: airtableRow?.apple_podcast_link,
      action: airtableRow?.action,
      scheduled_date_time: airtableRow?.scheduled_date_time,
      show_notes: airtableRow?.show_notes,
      date_booked: airtableRow?.date_booked,
      date_published: airtableRow?.date_published,
      episode_link: airtableRow?.link_to_episode,
    });
  });
  
  // Then, add Airtable-only podcasts (not matched to batch) with "Podcast recording" action
  airtableRows.forEach(airtableRow => {
    const normalizedAirtableTitle = normalizeTitle(airtableRow.podcast_name);
    
    // Check if already processed via exact or partial match
    const alreadyProcessed = processedAirtableTitles.has(normalizedAirtableTitle) ||
      Array.from(processedBatchTitles).some(batchTitle => 
        titlesMatch(airtableRow.podcast_name, batchTitle) || normalizedAirtableTitle === batchTitle
      );
    
    // Only include if not already processed AND has "Podcast recording" action
    if (!alreadyProcessed && 
        airtableRow.action?.toLowerCase().includes('podcast recording')) {
      merged.push({
        show_title: airtableRow.podcast_name,
        verdict: 'Not' as const, // Default for non-evaluated
        overall_score: 0,
        listeners_per_episode: undefined,
        social_reach: undefined,
        categories: undefined,
        rationale_short: 'Not evaluated in batch',
        apple_podcast_link: airtableRow.apple_podcast_link,
        action: airtableRow.action,
        scheduled_date_time: airtableRow.scheduled_date_time,
        show_notes: airtableRow.show_notes,
        date_booked: airtableRow.date_booked,
        date_published: airtableRow.date_published,
        episode_link: airtableRow.link_to_episode,
      });
    }
  });
  
  return merged;
}

// Calculate enhanced KPIs from Batch + Airtable
function calculateEnhancedKPIs(
  batchRows: BatchCSVRow[],
  airtableRows: AirtableCSVRow[],
  podcasts: PodcastReportEntry[],
  dateRange: { start: Date; end: Date }
): ReportData['kpis'] {
  console.log('[calculateEnhancedKPIs] Airtable summary', {
    totalRows: airtableRows.length,
    interviewActions: airtableRows.filter(r => r.action?.toLowerCase().includes('podcast recording')).length,
    booked: airtableRows.filter(r => r.date_booked && r.date_booked.trim() !== '').length,
    published: airtableRows.filter(r => r.date_published && r.date_published.trim() !== '').length,
    sample: airtableRows.slice(0, 3),
  });

  // Filter for successful batch rows - treat missing status as valid
  const successfulBatch = batchRows.filter(row => 
    (!row.status || row.status === 'success') && row.verdict && row.overall_score
  );
  
  // Existing batch KPIs
  const fit_count = successfulBatch.filter(r => r.verdict === 'Fit').length;
  const consider_count = successfulBatch.filter(r => r.verdict === 'Consider').length;
  const not_fit_count = successfulBatch.filter(r => r.verdict === 'Not').length;
  
  const scores = successfulBatch.map(r => parseFloat(String(r.overall_score)) || 0);
  const avg_score = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  
  // Total reach is now sum of monthly_listens (total show reach)
  const total_reach = successfulBatch.reduce((sum, r) => {
    const monthly = r.monthly_listens || 0;
    const parsed = typeof monthly === 'string' ? parseFloat(monthly) : monthly;
    return sum + (typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0);
  }, 0);
  
  // Total listeners per episode (sum for the quarter)
  const listenersPerEpisodeValues = successfulBatch
    .map(r => {
      const listeners = r.listeners_per_episode || 0;
      return typeof listeners === 'string' ? parseFloat(listeners) : listeners;
    })
    .filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  
  const total_listeners_per_episode = listenersPerEpisodeValues.reduce((a, b) => a + b, 0);
  
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
  
  const total_booked = airtableRows.filter(r => {
    // Only count "podcast recording" actions
    const isPodcastRecording = r.action?.toLowerCase().includes('podcast recording');
    if (!isPodcastRecording) return false;
    
    // Must have a date_booked
    if (!r.date_booked || r.date_booked.trim() === '') return false;
    
    // date_booked must be within the date range
    const bookedDate = parseAirtableDate(r.date_booked);
    if (!bookedDate) return false;
    
    return bookedDate >= dateRange.start && bookedDate <= dateRange.end;
  }).length;
  
  const total_published = airtableRows.filter(r => 
    r.date_published && r.date_published.trim() !== ''
  ).length;
  
  // Calculate total EMV from podcasts
  const total_emv = podcasts.reduce((sum, p) => sum + (p.true_emv || 0), 0);
  
  return {
    total_evaluated: successfulBatch.length,
    fit_count,
    consider_count,
    not_fit_count,
    avg_score: Math.round(avg_score * 10) / 10,
    total_reach,
    total_listeners_per_episode: Math.round(total_listeners_per_episode),
    total_social_reach,
    top_categories,
    total_interviews,
    total_booked,
    total_published,
    // Calculated metrics
    total_emv,
    sov_percentage: 0,
    geo_score: 0,
  };
}

// Calculate SOV analysis with multi-peer support or manual input
function calculateSOVAnalysis(
  airtableRows: AirtableCSVRow[],
  sovRows: SOVCSVRow[] | null,
  competitorName: string | null,
  manualCompetitors?: { name: string; role: string; count: number }[] | null
): ReportData['sov_analysis'] {
  // Count client interviews from Airtable (only "podcast recording")
  const clientCount = airtableRows.filter(
    row => row.action.toLowerCase() === 'podcast recording'
  ).length;

  let competitors: { name: string; interview_count: number }[] = [];

  // Use manual input if provided
  if (manualCompetitors && manualCompetitors.length > 0) {
    competitors = manualCompetitors.map(c => ({
      name: c.name,
      interview_count: c.count
    }));
  }
  // Otherwise use CSV data
  else if (sovRows && sovRows.length > 0) {
    // Group SOV rows by peer to count interviews per competitor
    const peerCounts = new Map<string, number>();
    sovRows.forEach(row => {
      const peerName = row.peer || 'Unknown Competitor';
      peerCounts.set(peerName, (peerCounts.get(peerName) || 0) + 1);
    });

    // Convert to competitors array
    competitors = Array.from(peerCounts.entries()).map(([name, count]) => ({
      name,
      interview_count: count
    }));
  }
  
  // Return null if no competitor data
  if (competitors.length === 0) return null;

  // Calculate totals
  const competitorTotalCount = competitors.reduce((sum, comp) => sum + comp.interview_count, 0);
  const totalInterviews = clientCount + competitorTotalCount;
  const clientPercentage = totalInterviews > 0 
    ? Math.round((clientCount / totalInterviews) * 100)
    : 0;

  return {
    client_interview_count: clientCount,
    client_percentage: clientPercentage,
    competitors
  };
}

// Calculate GEO analysis from Spotlight export
function calculateGEOAnalysis(geoRows: GEOCSVRow[]): ReportData['geo_analysis'] {
  if (!geoRows || geoRows.length === 0) return undefined;

  // Basic counts
  const total_podcasts_indexed = geoRows.length;
  
  // Unique AI engines
  const engineSet = new Set<string>();
  geoRows.forEach(row => {
    if (row.llm) engineSet.add(row.llm);
  });
  const unique_ai_engines = Array.from(engineSet);
  
  // AI engine counts
  const engineCounts = new Map<string, number>();
  geoRows.forEach(row => {
    if (row.llm) {
      engineCounts.set(row.llm, (engineCounts.get(row.llm) || 0) + 1);
    }
  });
  const ai_engine_counts = Array.from(engineCounts.entries())
    .map(([engine, count]) => ({ engine, count }))
    .sort((a, b) => b.count - a.count);
  
  // Top prompts
  const promptCounts = new Map<string, number>();
  geoRows.forEach(row => {
    if (row.prompt_text) {
      promptCounts.set(row.prompt_text, (promptCounts.get(row.prompt_text) || 0) + 1);
    }
  });
  const top_prompts = Array.from(promptCounts.entries())
    .map(([prompt, count]) => ({ prompt, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  
  // Topic distribution
  const topicCounts = new Map<string, number>();
  geoRows.forEach(row => {
    if (row.topic_name) {
      topicCounts.set(row.topic_name, (topicCounts.get(row.topic_name) || 0) + 1);
    }
  });
  const topic_distribution = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
  
  // Calculate GEO score (0-100)
  // AI Coverage: 0-40 points (5+ engines = max)
  const ai_coverage = Math.min((unique_ai_engines.length / 5) * 40, 40);
  
  // Topic Relevance: 0-30 points (10+ unique topics = max)
  const unique_topics = topic_distribution.length;
  const topic_relevance = Math.min((unique_topics / 10) * 30, 30);
  
  // Prompt Diversity: 0-30 points (20+ unique prompts = max)
  const unique_prompts = top_prompts.length;
  const prompt_diversity = Math.min((unique_prompts / 20) * 30, 30);
  
  const geo_score = Math.round(ai_coverage + topic_relevance + prompt_diversity);
  
  // Podcast entries for detailed view
  const podcast_entries = geoRows.map(row => ({
    title: row.title,
    uri: row.uri,
    llm: row.llm,
    prompt: row.prompt_text,
    topic: row.topic_name
  }));
  
  return {
    total_podcasts_indexed,
    unique_ai_engines,
    ai_engine_counts,
    top_prompts,
    topic_distribution,
    geo_score,
    score_breakdown: {
      ai_coverage: Math.round(ai_coverage),
      topic_relevance: Math.round(topic_relevance),
      prompt_diversity: Math.round(prompt_diversity)
    },
    podcast_entries
  };
}

// Calculate Content Gap Analysis from Spotlight export
export function calculateContentGapAnalysis(rows: ContentGapCSVRow[]): ContentGapAnalysis | undefined {
  if (!rows || rows.length === 0) return undefined;

  const total_prompts = rows.length;
  
  // Count gaps (prompts where client is NOT present in ANY engine)
  const gapRows = rows.filter(row => 
    row.engines.every(e => !e.present)
  );
  const total_gaps = gapRows.length;
  const coverage_percentage = Math.round(((total_prompts - total_gaps) / total_prompts) * 100);

  // Gaps by stage
  const stageMap = new Map<string, { gap_count: number; total: number }>();
  rows.forEach(row => {
    const stage = row.customer_journey || 'unknown';
    const current = stageMap.get(stage) || { gap_count: 0, total: 0 };
    current.total++;
    if (row.engines.every(e => !e.present)) {
      current.gap_count++;
    }
    stageMap.set(stage, current);
  });
  const gaps_by_stage = Array.from(stageMap.entries())
    .map(([stage, data]) => ({ stage, ...data }));

  // Gaps by topic
  const topicMap = new Map<string, { gap_count: number; total: number }>();
  rows.forEach(row => {
    const topic = row.topic || 'unknown';
    const current = topicMap.get(topic) || { gap_count: 0, total: 0 };
    current.total++;
    if (row.engines.every(e => !e.present)) {
      current.gap_count++;
    }
    topicMap.set(topic, current);
  });
  const gaps_by_topic = Array.from(topicMap.entries())
    .map(([topic, data]) => ({ topic, ...data }))
    .sort((a, b) => b.gap_count - a.gap_count);

  // Top competitors (from mentioned brands across all gap rows)
  const competitorCounts = new Map<string, number>();
  gapRows.forEach(row => {
    row.engines.forEach(engine => {
      engine.mentioned_brands.forEach(brand => {
        if (brand) {
          competitorCounts.set(brand, (competitorCounts.get(brand) || 0) + 1);
        }
      });
    });
  });
  const top_competitors = Array.from(competitorCounts.entries())
    .map(([name, mention_count]) => ({ name, mention_count }))
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 20);

  // Priority prompts (gaps with most competitors present)
  const priority_prompts = gapRows
    .map(row => {
      const engines_missing = row.engines.filter(e => !e.present).map(e => e.name);
      const allBrands = new Set<string>();
      row.engines.forEach(e => e.mentioned_brands.forEach(b => allBrands.add(b)));
      return {
        prompt: row.prompt,
        topic: row.topic,
        stage: row.customer_journey,
        engines_missing,
        competitors_present: Array.from(allBrands),
      };
    })
    .sort((a, b) => b.competitors_present.length - a.competitors_present.length)
    .slice(0, 20);

  return {
    total_gaps,
    total_prompts,
    coverage_percentage,
    gaps_by_stage,
    gaps_by_topic,
    top_competitors,
    priority_prompts,
  };
}

// Apply manual EMV data from Rephonic CSV
function applyRephonicEMVData(
  podcasts: PodcastReportEntry[],
  rephonicRows: RephonicCSVRow[],
  cpm: number = 50
): PodcastReportEntry[] {
  if (!rephonicRows || rephonicRows.length === 0) return podcasts;
  
  // Create a map of normalized podcast names to Rephonic data
  const rephonicMap = new Map<string, RephonicCSVRow>();
  rephonicRows.forEach(row => {
    if (row.podcast_name) {
      rephonicMap.set(normalizeTitle(row.podcast_name), row);
    }
  });
  
  return podcasts.map(podcast => {
    // Try to find matching Rephonic data
    const normalizedTitle = normalizeTitle(podcast.show_title);
    const rephonicData = rephonicMap.get(normalizedTitle);
    
    if (!rephonicData) return podcast;
    
    // Apply Rephonic data
    const updatedPodcast = { ...podcast };
    
    // Apply listeners if provided by Rephonic
    if (rephonicData.listeners_per_episode && !podcast.listeners_per_episode) {
      updatedPodcast.listeners_per_episode = rephonicData.listeners_per_episode;
    }
    
    // Apply duration if provided by Rephonic
    if (rephonicData.episode_duration_minutes && !podcast.episode_duration_minutes) {
      updatedPodcast.episode_duration_minutes = rephonicData.episode_duration_minutes;
    }
    
    // If Rephonic provides pre-calculated EMV, use it directly
    if (rephonicData.emv && rephonicData.emv > 0) {
      updatedPodcast.true_emv = rephonicData.emv;
      // Estimate other EMV fields from the total
      const listeners = updatedPodcast.listeners_per_episode || 5000;
      updatedPodcast.base_emv = (listeners / 1000) * cpm;
      updatedPodcast.ad_units = updatedPodcast.true_emv / updatedPodcast.base_emv;
      updatedPodcast.speaking_minutes = updatedPodcast.ad_units;
      updatedPodcast.value_per_minute = updatedPodcast.base_emv;
    } 
    // Otherwise recalculate EMV with the new data
    else if (updatedPodcast.listeners_per_episode && updatedPodcast.episode_duration_minutes) {
      const emvData = calculateEMV(updatedPodcast, cpm);
      if (emvData) {
        Object.assign(updatedPodcast, emvData);
      }
    }
    
    return updatedPodcast;
  });
}

// Calculate total EMV from Rephonic CSV (for combined EMV without per-podcast matching)
function calculateTotalRephonicEMV(rephonicRows: RephonicCSVRow[]): number {
  if (!rephonicRows || rephonicRows.length === 0) return 0;
  
  return rephonicRows.reduce((sum, row) => {
    return sum + (row.emv || 0);
  }, 0);
}

// New function for multi-CSV report generation
export async function generateReportFromMultipleCSVs(
  batchRows: BatchCSVRow[],
  airtableRows: AirtableCSVRow[],
  sovRows: SOVCSVRow[] | null,
  sovCompetitorName: string | null,
  geoRows: GEOCSVRow[],
  contentGapRows: ContentGapCSVRow[],
  client: MinimalClient,
  reportName: string,
  quarter: string,
  dateRange: { start: Date; end: Date },
  manualSOVCompetitors?: { name: string; role: string; count: number }[] | null,
  cpm: number = 50,
  rephonicRows?: RephonicCSVRow[],
  geoCsvProvided: boolean = false,
  contentGapCsvProvided: boolean = false
): Promise<ReportData> {
  
  // Step 1: Merge Batch + Airtable data by podcast title
  const mergedPodcasts = mergePodcastData(batchRows, airtableRows);
  
  // Step 2: Batch scrape episode durations
  const podcastsWithDuration = await batchScrapeDurations(mergedPodcasts);
  
  // Step 3: Apply EMV calculations (scraped data first)
  let podcastsWithEMV = applyEMVCalculations(podcastsWithDuration, cpm);
  
  // Step 3b: Apply Rephonic EMV data if provided (overrides/supplements scraped data)
  if (rephonicRows && rephonicRows.length > 0) {
    podcastsWithEMV = applyRephonicEMVData(podcastsWithEMV, rephonicRows, cpm);
  }
  
  // Step 4: Calculate enhanced KPIs (now includes total EMV)
  const kpis = calculateEnhancedKPIs(batchRows, airtableRows, podcastsWithEMV, dateRange);
  
  // If Rephonic data provided with pre-calculated EMV totals, use that for total_emv
  if (rephonicRows && rephonicRows.length > 0) {
    const rephonicTotalEMV = calculateTotalRephonicEMV(rephonicRows);
    if (rephonicTotalEMV > 0) {
      kpis.total_emv = rephonicTotalEMV;
    }
  }
  
  // Step 5: Calculate SOV if provided (either CSV or manual)
  const sov_analysis = (sovRows || manualSOVCompetitors)
    ? calculateSOVAnalysis(airtableRows, sovRows, sovCompetitorName, manualSOVCompetitors)
    : undefined;
  
  // Step 6: Calculate GEO if provided
  const geo_analysis = geoRows && geoRows.length > 0
    ? calculateGEOAnalysis(geoRows)
    : undefined;
  
  // Step 7: Calculate Content Gap if provided
  const content_gap_analysis = contentGapRows && contentGapRows.length > 0
    ? calculateContentGapAnalysis(contentGapRows)
    : undefined;
  
  // Step 8: Sort podcasts by score
  const sortedPodcasts = podcastsWithEMV.sort((a, b) => 
    b.overall_score - a.overall_score
  );
  
  // Generate executive summary with KPI references
  const executiveSummary = generateExecutiveSummary(client, kpis, quarter);
  
  // Generate next quarter strategy
  const next_quarter_strategy = generateNextQuarterStrategy(client, kpis, quarter);
  
  return {
    client,
    generated_at: new Date().toISOString(),
    batch_name: reportName,
    quarter,
    date_range: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
    cpm,
    kpis,
    campaign_overview: {
      strategy: generateStrategyParagraph(client),
      executive_summary: executiveSummary,
      target_audiences: pickTopAudienceTags({
        strategyText: client.campaign_strategy,
        audiences: client.target_audiences,
        max: 3
      }),
      talking_points: client.talking_points?.slice(0, 3) || [],
    },
    podcasts: sortedPodcasts,
    sov_analysis,
    geo_analysis,
    content_gap_analysis,
    next_quarter_strategy,
    report_type: 'single',
    geo_csv_uploaded: geoCsvProvided,
    content_gap_csv_uploaded: contentGapCsvProvided,
  };
}

// Per-speaker KPI calculation helper
function calculateSpeakerKPIs(
  batchRows: BatchCSVRow[],
  airtableRows: AirtableCSVRow[],
  podcasts: PodcastReportEntry[],
  dateRange: { start: Date; end: Date }
): SpeakerBreakdown['kpis'] {
  // Filter for successful batch rows
  const successfulBatch = batchRows.filter(row => 
    (!row.status || row.status === 'success') && row.verdict && row.overall_score
  );
  
  const scores = successfulBatch.map(r => parseFloat(String(r.overall_score)) || 0);
  const avg_score = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  
  // Total reach is now sum of monthly_listens
  const total_reach = successfulBatch.reduce((sum, r) => {
    const monthly = r.monthly_listens || 0;
    const parsed = typeof monthly === 'string' ? parseFloat(monthly) : monthly;
    return sum + (typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0);
  }, 0);
  
  const total_social_reach = successfulBatch.reduce((sum, r) => {
    const social = r.social_reach || 0;
    const parsed = typeof social === 'string' ? parseFloat(social) : social;
    return sum + (typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0);
  }, 0);
  
  const total_booked = airtableRows.filter(r => {
    // Only count "podcast recording" actions
    const isPodcastRecording = r.action?.toLowerCase().includes('podcast recording');
    if (!isPodcastRecording) return false;
    
    // Must have a date_booked
    if (!r.date_booked || r.date_booked.trim() === '') return false;
    
    // date_booked must be within the date range
    const bookedDate = parseAirtableDate(r.date_booked);
    if (!bookedDate) return false;
    
    return bookedDate >= dateRange.start && bookedDate <= dateRange.end;
  }).length;
  
  const total_published = airtableRows.filter(r => 
    r.date_published && r.date_published.trim() !== ''
  ).length;
  
  const total_emv = podcasts.reduce((sum, p) => sum + (p.true_emv || 0), 0);
  
  return {
    total_booked,
    total_published,
    total_reach,
    total_social_reach,
    avg_score: Math.round(avg_score * 10) / 10,
    total_emv,
  };
}

// Multi-speaker report generation
export interface SpeakerDataInput {
  speaker: Speaker;
  batchRows: BatchCSVRow[];
  airtableRows: AirtableCSVRow[];
}

export async function generateMultiSpeakerReport(
  speakerData: SpeakerDataInput[],
  // Company-level shared data
  sovRows: SOVCSVRow[] | null,
  geoRows: GEOCSVRow[],
  contentGapRows: ContentGapCSVRow[],
  company: Company,
  reportName: string,
  quarter: string,
  dateRange: { start: Date; end: Date },
  manualSOVCompetitors?: { name: string; role: string; count: number }[] | null,
  cpm: number = 50,
  rephonicRows?: RephonicCSVRow[],
  geoCsvProvided: boolean = false,
  contentGapCsvProvided: boolean = false
): Promise<ReportData> {
  
  // Process each speaker's data
  const speakerBreakdowns: SpeakerBreakdown[] = [];
  let allPodcasts: PodcastReportEntry[] = [];
  let allBatchRows: BatchCSVRow[] = [];
  let allAirtableRows: AirtableCSVRow[] = [];
  
  for (const { speaker, batchRows, airtableRows } of speakerData) {
    // Merge per-speaker batch + airtable data
    const mergedPodcasts = mergePodcastData(batchRows, airtableRows);
    
    // Scrape durations and calculate EMV
    const podcastsWithDuration = await batchScrapeDurations(mergedPodcasts);
    const podcastsWithEMV = applyEMVCalculations(podcastsWithDuration, cpm);
    
    // Calculate per-speaker KPIs
    const speakerKpis = calculateSpeakerKPIs(batchRows, airtableRows, podcastsWithEMV, dateRange);
    
    speakerBreakdowns.push({
      speaker_id: speaker.id,
      speaker_name: speaker.name,
      speaker_title: speaker.title || undefined,
      airtable_embed_url: speaker.airtable_embed_url || undefined,
      // Include strategy insights from speaker profile
      campaign_strategy: speaker.campaign_strategy || undefined,
      target_audiences: speaker.target_audiences || [],
      talking_points: speaker.talking_points || [],
      professional_credentials: speaker.professional_credentials || [],
      kpis: speakerKpis,
      podcasts: podcastsWithEMV,
    });
    
    // Aggregate for company-level calculations
    allPodcasts = [...allPodcasts, ...podcastsWithEMV];
    allBatchRows = [...allBatchRows, ...batchRows];
    allAirtableRows = [...allAirtableRows, ...airtableRows];
  }
  
  // Calculate aggregated company KPIs
  const aggregatedKpis = calculateAggregatedKPIs(speakerBreakdowns, allBatchRows, allAirtableRows, allPodcasts);
  
  // If Rephonic data provided with pre-calculated EMV totals, use that for total_emv (combined for all speakers)
  if (rephonicRows && rephonicRows.length > 0) {
    const rephonicTotalEMV = calculateTotalRephonicEMV(rephonicRows);
    if (rephonicTotalEMV > 0) {
      aggregatedKpis.total_emv = rephonicTotalEMV;
    }
  }
  
  // Calculate company-level SOV
  const sov_analysis = (sovRows || manualSOVCompetitors)
    ? calculateSOVAnalysis(allAirtableRows, sovRows, null, manualSOVCompetitors)
    : undefined;
  
  // Calculate company-level GEO
  const geo_analysis = geoRows && geoRows.length > 0
    ? calculateGEOAnalysis(geoRows)
    : undefined;
  
  // Calculate company-level Content Gap
  const content_gap_analysis = contentGapRows && contentGapRows.length > 0
    ? calculateContentGapAnalysis(contentGapRows)
    : undefined;
  
  // Create company-level client for campaign overview
  const companyClient: MinimalClient = {
    id: company.id,
    name: company.name,
    company: company.name,
    company_url: company.company_url || '',
    logo_url: company.logo_url || '',
    brand_colors: company.brand_colors as any || undefined,
    media_kit_url: '',
    // Aggregate target audiences and talking points from first speaker (for overview)
    target_audiences: speakerData[0]?.speaker.target_audiences || [],
    talking_points: speakerData[0]?.speaker.talking_points || [],
    avoid: [],
    notes: company.notes || '',
    campaign_strategy: speakerData[0]?.speaker.campaign_strategy || '',
    campaign_manager: company.campaign_manager || '',
    pitch_template: '',
    title: '',
    gender: undefined,
    guest_identity_tags: [],
    professional_credentials: [],
    competitors: [],
    airtable_embed_url: company.airtable_embed_url || ''
  };
  
  // Generate company-level executive summary
  const executiveSummary = generateMultiSpeakerExecutiveSummary(
    company.name,
    speakerBreakdowns,
    aggregatedKpis,
    quarter
  );
  
  // Generate next quarter strategy
  const next_quarter_strategy = generateNextQuarterStrategy(companyClient, aggregatedKpis, quarter);
  
  return {
    client: companyClient,
    generated_at: new Date().toISOString(),
    batch_name: reportName,
    quarter,
    date_range: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
    cpm,
    kpis: aggregatedKpis,
    campaign_overview: {
      strategy: generateCompanyStrategyParagraph(company.name, speakerBreakdowns),
      executive_summary: executiveSummary,
      target_audiences: speakerData[0]?.speaker.target_audiences?.slice(0, 3) || [],
      talking_points: speakerData[0]?.speaker.talking_points?.slice(0, 3) || [],
    },
    podcasts: allPodcasts.sort((a, b) => b.overall_score - a.overall_score),
    sov_analysis,
    geo_analysis,
    content_gap_analysis,
    next_quarter_strategy,
    report_type: 'multi',
    company_name: company.name,
    selected_speaker_ids: speakerData.map(s => s.speaker.id),
    speaker_breakdowns: speakerBreakdowns,
    geo_csv_uploaded: geoCsvProvided,
    content_gap_csv_uploaded: contentGapCsvProvided,
  };
}

// Calculate aggregated KPIs from speaker breakdowns
function calculateAggregatedKPIs(
  speakerBreakdowns: SpeakerBreakdown[],
  allBatchRows: BatchCSVRow[],
  allAirtableRows: AirtableCSVRow[],
  allPodcasts: PodcastReportEntry[]
): ReportData['kpis'] {
  // Sum metrics
  const total_booked = speakerBreakdowns.reduce((sum, s) => sum + s.kpis.total_booked, 0);
  const total_published = speakerBreakdowns.reduce((sum, s) => sum + s.kpis.total_published, 0);
  const total_reach = speakerBreakdowns.reduce((sum, s) => sum + s.kpis.total_reach, 0);
  const total_social_reach = speakerBreakdowns.reduce((sum, s) => sum + s.kpis.total_social_reach, 0);
  const total_emv = speakerBreakdowns.reduce((sum, s) => sum + (s.kpis.total_emv || 0), 0);
  
  // Average score
  const allScores = speakerBreakdowns.map(s => s.kpis.avg_score).filter(s => s > 0);
  const avg_score = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;
  
  // Calculate verdict counts from all batch rows
  const successfulBatch = allBatchRows.filter(row => 
    (!row.status || row.status === 'success') && row.verdict && row.overall_score
  );
  const fit_count = successfulBatch.filter(r => r.verdict === 'Fit').length;
  const consider_count = successfulBatch.filter(r => r.verdict === 'Consider').length;
  const not_fit_count = successfulBatch.filter(r => r.verdict === 'Not').length;
  
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
  
  // Count total interviews
  const total_interviews = allAirtableRows.filter(r => 
    r.action?.toLowerCase().includes('podcast recording')
  ).length;
  
  // Calculate total_listeners_per_episode from all batch rows (sum for the quarter)
  const listenersPerEpisodeValues = successfulBatch
    .map(r => {
      const listeners = r.listeners_per_episode || 0;
      return typeof listeners === 'string' ? parseFloat(listeners) : listeners;
    })
    .filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  
  const total_listeners_per_episode = listenersPerEpisodeValues.reduce((a, b) => a + b, 0);

  return {
    total_evaluated: successfulBatch.length,
    fit_count,
    consider_count,
    not_fit_count,
    avg_score: Math.round(avg_score * 10) / 10,
    total_reach,
    total_listeners_per_episode: Math.round(total_listeners_per_episode),
    total_social_reach,
    top_categories,
    total_interviews,
    total_booked,
    total_published,
    total_emv,
    sov_percentage: 0,
    geo_score: 0,
  };
}

// Generate company strategy paragraph for multi-speaker
function generateCompanyStrategyParagraph(
  companyName: string,
  speakerBreakdowns: SpeakerBreakdown[]
): string {
  const speakerNames = speakerBreakdowns.map(s => s.speaker_name).join(', ');
  const speakerCount = speakerBreakdowns.length;
  
  return `This multi-speaker campaign positions ${companyName} as an industry thought leader through ${speakerCount} speakers: ${speakerNames}. Each speaker brings unique expertise and perspectives to reach diverse podcast audiences, collectively building the company's visibility and authority in the space.`;
}

// Generate executive summary for multi-speaker
function generateMultiSpeakerExecutiveSummary(
  companyName: string,
  speakerBreakdowns: SpeakerBreakdown[],
  kpis: ReportData['kpis'],
  quarter: string
): string {
  const { total_booked, total_published, total_reach, total_social_reach, total_emv } = kpis;
  const speakerCount = speakerBreakdowns.length;
  
  let summary = `In ${quarter}, ${companyName}'s podcast campaign featured ${speakerCount} speakers across strategic podcast placements. `;
  
  if (total_booked > 0 || total_published > 0) {
    summary += `Collectively, we secured ${total_booked} podcast booking${total_booked !== 1 ? 's' : ''} this quarter`;
    
    if (total_published > 0) {
      summary += ` with ${total_published} episode${total_published !== 1 ? 's' : ''} now live`;
    }
    
    if (total_reach > 0) {
      summary += `, reaching an estimated ${formatNumber(total_reach)} monthly listeners`;
    }
    
    if (total_social_reach > 0) {
      summary += ` with potential amplification to ~${formatNumber(total_social_reach)} through host and show social platforms`;
    }
    
    summary += '. ';
  }
  
  // Add speaker breakdown summary
  const speakerSummaries = speakerBreakdowns
    .map(s => `${s.speaker_name.split(' ')[0]} (${s.kpis.total_booked} bookings)`)
    .join(', ');
  
  summary += `Speaker breakdown: ${speakerSummaries}.`;
  
  if (total_emv && total_emv > 0) {
    summary += ` The combined campaign generated an estimated ${formatCurrency(total_emv)} in earned media value.`;
  }
  
  return summary;
}

// Helper: Format currency
function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}
