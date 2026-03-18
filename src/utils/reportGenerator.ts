import { MinimalClient, Speaker, Company } from '@/types/clients';
import { BatchRow } from '@/types/batch';
import { ReportData, PodcastReportEntry, ContentGapAnalysis, SpeakerBreakdown } from '@/types/reports';
import { BatchCSVRow, AirtableCSVRow, SOVCSVRow, GEOCSVRow, ContentGapCSVRow, RephonicCSVRow } from '@/types/csv';
import { pickTopAudienceTags } from '@/lib/campaignStrategy';
import { normalizeTitle, parseAirtableDate, titlesMatch } from './csvParsers';
import { supabase } from '@/integrations/supabase/client';
import { callScrape, callAnalyze } from '@/utils/api';

// Fetch podcast metrics from Rephonic API with caching
export async function fetchPodcastMetrics(
  applePodcastUrls: string[]
): Promise<RephonicCSVRow[]> {
  if (!applePodcastUrls || applePodcastUrls.length === 0) return [];
  
  // Deduplicate URLs
  const uniqueUrls = [...new Set(applePodcastUrls.filter(u => u && u.trim()))];
  if (uniqueUrls.length === 0) return [];
  
  console.log(`[fetchPodcastMetrics] Fetching metrics for ${uniqueUrls.length} podcasts`);
  
  const results: RephonicCSVRow[] = [];
  const urlsToFetch: string[] = [];
  
  // Step 1: Check cache first
  try {
    const { data: cached, error } = await supabase
      .from('podcast_metadata_cache')
      .select('*')
      .in('apple_podcast_url', uniqueUrls);
    
    if (!error && cached && cached.length > 0) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const cachedUrls = new Set<string>();
      for (const row of cached) {
        const fetchedAt = new Date(row.fetched_at);
        const hasMetrics = row.listeners_per_episode !== null || row.monthly_listens !== null || row.social_reach !== null;
        if (fetchedAt >= thirtyDaysAgo && hasMetrics) {
          results.push({
            podcast_name: row.podcast_name || '',
            listeners_per_episode: row.listeners_per_episode || undefined,
            monthly_listens: row.monthly_listens || undefined,
            social_reach: row.social_reach || undefined,
            categories: row.categories || undefined,
            description: row.description || undefined,
            apple_podcast_link: row.apple_podcast_url,
          });
          cachedUrls.add(row.apple_podcast_url);
        }
      }
      
      console.log(`[fetchPodcastMetrics] Cache hits: ${cachedUrls.size}/${uniqueUrls.length}`);
      
      for (const url of uniqueUrls) {
        if (!cachedUrls.has(url)) urlsToFetch.push(url);
      }
    } else {
      urlsToFetch.push(...uniqueUrls);
    }
  } catch (err) {
    console.warn('[fetchPodcastMetrics] Cache check failed, fetching all:', err);
    urlsToFetch.push(...uniqueUrls);
  }
  
  // Step 2: Fetch missing from Rephonic API
  if (urlsToFetch.length > 0) {
    console.log(`[fetchPodcastMetrics] Fetching ${urlsToFetch.length} from Rephonic API`);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-rephonic-metrics', {
        body: { apple_podcast_urls: urlsToFetch }
      });
      
      if (error) {
        console.error('[fetchPodcastMetrics] Rephonic edge function error:', error);
      } else if (data?.results) {
        const fetchedResults = data.results as Record<string, any>;
        
        for (const [url, metrics] of Object.entries(fetchedResults)) {
          if ((metrics as any).error) {
            console.warn(`[fetchPodcastMetrics] No data for ${url}: ${(metrics as any).error}`);
            continue;
          }
          
          const row: RephonicCSVRow = {
            podcast_name: (metrics as any).podcast_name || '',
            listeners_per_episode: (metrics as any).listeners_per_episode || undefined,
            monthly_listens: (metrics as any).monthly_listens || undefined,
            social_reach: (metrics as any).social_reach || undefined,
            categories: (metrics as any).categories || undefined,
            description: (metrics as any).description || undefined,
            apple_podcast_link: url,
          };
          results.push(row);
          
          // Step 3: Cache the result (fire-and-forget)
          supabase
            .from('podcast_metadata_cache')
            .upsert({
              apple_podcast_url: url,
              podcast_name: row.podcast_name,
              listeners_per_episode: row.listeners_per_episode || null,
              monthly_listens: row.monthly_listens || null,
              social_reach: row.social_reach || null,
              categories: row.categories || null,
              description: row.description || null,
              fetched_at: new Date().toISOString(),
              org_id: '11111111-1111-1111-1111-111111111111',
            }, { onConflict: 'apple_podcast_url,org_id' })
            .then(({ error: upsertError }) => {
              if (upsertError) console.warn('[fetchPodcastMetrics] Cache upsert error:', upsertError);
            });
        }
        
        console.log(`[fetchPodcastMetrics] Fetched ${Object.keys(fetchedResults).length} results from Rephonic`);
      }
    } catch (err) {
      console.error('[fetchPodcastMetrics] Failed to call edge function:', err);
    }
  }
  
  console.log(`[fetchPodcastMetrics] Total results: ${results.length}`);
  return results;
}

// Backward-compatible alias
export const fetchPodchaserMetrics = fetchPodcastMetrics;

// Safely get action as a string (Airtable API may return arrays for select fields)
function getActionString(action: any): string {
  if (!action) return '';
  if (Array.isArray(action)) return action[0] || '';
  return String(action);
}

// Score Airtable podcasts by scraping show notes and running through analyze engine
export async function scoreAirtablePodcasts(
  airtableRows: AirtableCSVRow[],
  client: MinimalClient,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchCSVRow[]> {
  // Filter to podcast recordings only
  const podcastRows = airtableRows.filter(
    row => getActionString(row.action).toLowerCase().includes('podcast recording')
  );

  if (podcastRows.length === 0) return [];

  const results: BatchCSVRow[] = [];
  const BATCH_SIZE = 3;

  for (let i = 0; i < podcastRows.length; i += BATCH_SIZE) {
    const batch = podcastRows.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (row): Promise<BatchCSVRow> => {
        try {
          let showNotesText = row.show_notes || '';

          // If show_notes is a URL, scrape it
          if (showNotesText.match(/^https?:\/\//i)) {
            const scrapeResult = await callScrape(showNotesText);
            if (scrapeResult?.success && scrapeResult?.text) {
              showNotesText = scrapeResult.text;
            } else {
              console.warn(`Failed to scrape show notes for ${row.podcast_name}:`, scrapeResult?.error);
              // Use URL as fallback text
              showNotesText = `Podcast: ${row.podcast_name}`;
            }
          }

          // Skip if no show notes content
          if (!showNotesText.trim()) {
            return {
              show_title: row.podcast_name,
              verdict: 'Consider' as const,
              overall_score: 5,
              status: 'success',
              rationale_short: 'No show notes available for scoring',
            };
          }

          // Call analyze with client profile + show notes
          const analyzeResult = await callAnalyze({
            client,
            show_notes: showNotesText,
          });

          if (analyzeResult?.success && analyzeResult?.data) {
            const data = analyzeResult.data;
            // Map verdict from analyze format to report format
            let verdict: 'Fit' | 'Consider' | 'Not' = 'Consider';
            if (data.verdict === 'recommend') verdict = 'Fit';
            else if (data.verdict === 'not_recommended') verdict = 'Not';
            else if (data.verdict === 'consider') verdict = 'Consider';
            // Fallback: derive from score if no verdict field
            else if (data.overall_score >= 7.5) verdict = 'Fit';
            else if (data.overall_score >= 5) verdict = 'Consider';
            else verdict = 'Not';

            return {
              show_title: row.podcast_name,
              verdict,
              overall_score: data.overall_score,
              rationale_short: data.verdict_reason || data.summary_text || '',
              status: 'success',
            };
          }

          // Fallback data if analyze returned fallback
          if (analyzeResult?.fallback_data) {
            const fb = analyzeResult.fallback_data;
            return {
              show_title: row.podcast_name,
              verdict: fb.overall_score >= 7.5 ? 'Fit' : fb.overall_score >= 5 ? 'Consider' : 'Not',
              overall_score: fb.overall_score,
              rationale_short: fb.verdict_reason || 'Scored via fallback heuristic',
              status: 'success',
            };
          }

          return {
            show_title: row.podcast_name,
            verdict: 'Consider' as const,
            overall_score: 5,
            status: 'failed',
            rationale_short: analyzeResult?.error || 'Analysis failed',
          };
        } catch (err) {
          console.error(`Error scoring ${row.podcast_name}:`, err);
          return {
            show_title: row.podcast_name,
            verdict: 'Consider' as const,
            overall_score: 5,
            status: 'failed',
            rationale_short: err instanceof Error ? err.message : 'Scoring error',
          };
        }
      })
    );

    results.push(...batchResults);
    onProgress?.(results.length, podcastRows.length);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < podcastRows.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// Generate AI-powered pitch hooks for a speaker
export async function generatePitchHooksForSpeaker(speaker: {
  name: string;
  title?: string | null;
  company?: string;
  target_audiences?: string[] | null;
  talking_points?: string[] | null;
  campaign_strategy?: string | null;
  professional_credentials?: string[] | null;
  guest_identity_tags?: string[] | null;
}): Promise<string[]> {
  try {
    console.log('Generating AI pitch hooks for:', speaker.name);
    
    const { data, error } = await supabase.functions.invoke('generate-pitch-hooks', {
      body: { 
        speaker: {
          name: speaker.name,
          title: speaker.title || undefined,
          company: speaker.company,
          target_audiences: speaker.target_audiences || undefined,
          talking_points: speaker.talking_points || undefined,
          campaign_strategy: speaker.campaign_strategy || undefined,
          professional_credentials: speaker.professional_credentials || undefined,
          guest_identity_tags: speaker.guest_identity_tags || undefined,
        }
      }
    });

    if (error) {
      console.error('Error generating pitch hooks:', error);
      // Fallback to talking points if AI fails
      return speaker.talking_points?.slice(0, 3) || [];
    }

    if (data?.hooks && Array.isArray(data.hooks) && data.hooks.length > 0) {
      console.log('AI generated hooks:', data.hooks);
      return data.hooks;
    }

    // Fallback to talking points
    return speaker.talking_points?.slice(0, 3) || [];
  } catch (err) {
    console.error('Failed to generate pitch hooks:', err);
    return speaker.talking_points?.slice(0, 3) || [];
  }
}

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

// Extract first name, skipping honorific prefixes like Dr., Mr., Ms., etc.
function extractFirstName(fullName: string): string {
  const honorifics = ['dr.', 'dr', 'mr.', 'mr', 'ms.', 'ms', 'mrs.', 'mrs', 'prof.', 'prof', 'rev.', 'rev', 'sir'];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1 && honorifics.includes(parts[0].toLowerCase())) {
    // Return "Dr. FirstName" to keep the honorific but use the actual first name
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}

// AI-generated campaign overview using quarterly podcast data
async function generateAICampaignOverview(
  speaker: { name: string; title?: string; company?: string; target_audiences?: string[]; talking_points?: string[]; campaign_strategy?: string; professional_credentials?: string[] },
  podcasts: Array<{ show_title: string; categories?: string; show_notes?: string }>,
  kpis: { total_booked: number; total_published: number; total_reach: number; top_categories?: Array<{ name: string }> },
  quarter?: string
): Promise<{ strategy: string; talking_points: string[] } | null> {
  try {
    console.log('[generateAICampaignOverview] Calling edge function...');
    const { data, error } = await supabase.functions.invoke('generate-campaign-overview', {
      body: { speaker, podcasts, kpis, quarter }
    });
    
    if (error) {
      console.error('[generateAICampaignOverview] Error:', error);
      return null;
    }
    
    if (data?.strategy && Array.isArray(data?.talking_points)) {
      console.log('[generateAICampaignOverview] Success');
      return { strategy: data.strategy, talking_points: data.talking_points };
    }
    
    console.warn('[generateAICampaignOverview] Unexpected response:', data);
    return null;
  } catch (err) {
    console.error('[generateAICampaignOverview] Failed:', err);
    return null;
  }
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

// Generate AI-powered looking-ahead content via edge function
export async function generateAITalkingPoints(
  speakers: Array<{
    name: string;
    title?: string | null;
    company?: string;
    talking_points?: string[] | null;
    target_audiences?: string[] | null;
    campaign_strategy?: string | null;
    professional_credentials?: string[] | null;
    guest_identity_tags?: string[] | null;
  }>,
  nextQuarter: string, // The quarter these talking points are FOR (next quarter)
  kpis?: {
    total_booked?: number;
    total_published?: number;
    total_reach?: number;
    top_categories?: Array<{ name: string; count: number }>;
  },
  isMultiSpeaker: boolean = false,
  reportQuarter?: string, // The quarter the report covers (current/past quarter)
  podcasts?: Array<{ show_title: string; categories?: string; show_notes?: string }>,
  quarterlyNotes?: Array<{ quarter: string; notes: string }>,
  competitorData?: Array<{ name: string; interview_count: number; episode_urls?: string[] }>
): Promise<{
  talking_points_spotlight?: Array<{ title: string; description: string }>;
  speaker_talking_points_spotlight?: Array<{ speaker_name: string; points: Array<{ title: string; description: string }> }>;
  intro_paragraph?: string;
  strategic_focus_areas?: Array<{ title: string; description: string }>;
  closing_paragraph?: string;
}> {
  try {
    console.log(`Generating AI looking-ahead content for ${speakers.length} speaker(s), multi-speaker: ${isMultiSpeaker}, nextQuarter: ${nextQuarter}, reportQuarter: ${reportQuarter}`);
    
    const { data, error } = await supabase.functions.invoke('generate-talking-points', {
      body: {
        speakers: speakers.map(s => ({
          name: s.name,
          title: s.title || undefined,
          company: s.company,
          talking_points: s.talking_points || undefined,
          target_audiences: s.target_audiences || undefined,
          campaign_strategy: s.campaign_strategy || undefined,
          professional_credentials: s.professional_credentials || undefined,
          guest_identity_tags: s.guest_identity_tags || undefined,
        })),
        quarter: nextQuarter,
        reportQuarter,
        kpis,
        isMultiSpeaker,
        podcasts: podcasts?.slice(0, 15)?.map(p => ({
          show_title: p.show_title,
          categories: p.categories,
          show_notes: p.show_notes,
        })),
        quarterly_notes: quarterlyNotes?.slice(0, 5)?.map(n => ({
          quarter: n.quarter,
          notes: n.notes,
        })),
        competitor_data: competitorData?.filter(c => c.interview_count > 0)?.map(c => ({
          name: c.name,
          interview_count: c.interview_count,
          episode_urls: c.episode_urls?.slice(0, 10),
        })),
      }
    });

    if (error) {
      console.error('Error generating AI talking points:', error);
      return {};
    }

    console.log('AI looking-ahead content generated:', data);
    return data || {};
  } catch (err) {
    console.error('Failed to generate AI talking points:', err);
    return {};
  }
}

// Generate talking point spotlight description (fallback/helper)
export function generateTalkingPointDescription(talkingPoint: string, clientName?: string): string {
  // Extract key themes and create a strategic framing
  const pointLower = talkingPoint.toLowerCase();
  const name = clientName || 'the guest';
  
  if (pointLower.includes('ai') || pointLower.includes('automation') || pointLower.includes('artificial intelligence')) {
    return `Emphasize ${name}'s practical AI applications and automation strategies that give hosts actionable insights to share with their audiences.`;
  }
  if (pointLower.includes('growth') || pointLower.includes('scale') || pointLower.includes('scaling')) {
    return `Highlight ${name}'s growth frameworks and scaling strategies that resonate with ambitious audiences seeking proven playbooks.`;
  }
  if (pointLower.includes('leadership') || pointLower.includes('team') || pointLower.includes('management')) {
    return `Position ${name}'s leadership insights as a bridge between team challenges and organizational success.`;
  }
  if (pointLower.includes('product') || pointLower.includes('launch') || pointLower.includes('innovation')) {
    return `Frame ${name}'s product updates and launches as timely news hooks that create urgency for podcast hosts.`;
  }
  if (pointLower.includes('marketing') || pointLower.includes('brand') || pointLower.includes('content')) {
    return `Showcase ${name}'s marketing expertise and brand-building strategies that resonate with growth-focused audiences.`;
  }
  if (pointLower.includes('sales') || pointLower.includes('revenue') || pointLower.includes('customer')) {
    return `Emphasize ${name}'s revenue and customer acquisition strategies that appeal to business-focused podcast audiences.`;
  }
  if (pointLower.includes('fundrais') || pointLower.includes('invest') || pointLower.includes('capital')) {
    return `Highlight ${name}'s fundraising journey and investment insights that resonate with entrepreneurial audiences.`;
  }
  if (pointLower.includes('culture') || pointLower.includes('hiring') || pointLower.includes('talent')) {
    return `Share ${name}'s perspectives on building culture and attracting talent that appeal to leadership-focused shows.`;
  }
  if (pointLower.includes('data') || pointLower.includes('analytics') || pointLower.includes('metrics')) {
    return `Position ${name}'s data-driven approach and analytical insights as valuable takeaways for strategic decision-makers.`;
  }
  if (pointLower.includes('strateg') || pointLower.includes('vision') || pointLower.includes('future')) {
    return `Share ${name}'s strategic vision and forward-thinking perspectives that position them as an industry thought leader.`;
  }
  
  // Default - create a personalized description
  return `Emphasize ${name}'s unique perspective on ${talkingPoint.toLowerCase()} to create compelling conversations that resonate with podcast audiences.`;
}

// Generate next quarter strategy section
function generateNextQuarterStrategy(
  client: MinimalClient,
  kpis: ReportData['kpis'],
  currentQuarter: string,
  speakerCount: number = 1,
  speakerNames?: string[]
): ReportData['next_quarter_strategy'] {
  const nextQuarter = getNextQuarter(currentQuarter);
  const topicSpace = deriveTopicSpaceFromCategories(kpis);
  const pronoun = client.gender === 'female' ? 'her' : client.gender === 'male' ? 'his' : 'their';
  const firstName = extractFirstName(client.name);
  
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
  // Use the exported function for consistency
  const talkingPoints = client.talking_points?.slice(0, 3) || [];
  const talking_points_spotlight = talkingPoints.map(point => ({
    title: point.length > 50 ? point.substring(0, 50) + '...' : point,
    description: generateTalkingPointDescription(point, firstName)
  }));
  
  // If no talking points, create default from target audiences or campaign strategy
  if (talking_points_spotlight.length === 0) {
    // Try to extract from campaign strategy
    const strategy = client.campaign_strategy || '';
    const strategyLines = strategy.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
    
    if (strategyLines.length > 0) {
      // Use first 3 strategy bullet points
      strategyLines.slice(0, 3).forEach(line => {
        const cleaned = line.replace(/^[-•*]\s*/, '').trim();
        if (cleaned) {
          talking_points_spotlight.push({
            title: cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned,
            description: generateTalkingPointDescription(cleaned, firstName)
          });
        }
      });
    }
    
    // If still empty, create default based on available data
    if (talking_points_spotlight.length === 0) {
      if (audiences.length > 0) {
        // Create talking points based on audiences
        talking_points_spotlight.push({
          title: 'Industry Expertise',
          description: `Emphasize ${firstName}'s deep expertise in ${audiences[0]?.toLowerCase() || 'the industry'} to create compelling conversations.`
        });
        if (audiences.length > 1) {
          talking_points_spotlight.push({
            title: 'Thought Leadership',
            description: `Position ${firstName} as a thought leader speaking to ${audiences[1]?.toLowerCase() || 'key decision-makers'}.`
          });
        }
      } else {
        talking_points_spotlight.push({
          title: 'Core Expertise',
          description: `Emphasize ${firstName}'s unique perspective and expertise to create compelling conversations.`
        });
      }
    }
  }
  
  // Generate closing paragraph
  const companyMention = client.company && client.company !== client.name 
    ? ` while keeping ${client.company}'s mission front and center`
    : '';
  const closing_paragraph = `By amplifying these themes on ${topicSpace} podcasts, we'll continue to increase ${firstName}'s visibility with the right audiences${companyMention} in the broader conversation about ${topicSpace}.`;
  
  // Calculate Next Quarter KPIs
  // High impact podcasts: 3 per speaker per month × 3 months
  const high_impact_podcasts_goal = 3 * speakerCount * 3;
  // Listenership goal: 20% increase over current quarter
  const currentListenership = kpis.total_reach || 0;
  const listenership_goal = Math.ceil(currentListenership * 1.2);
  
  // Current annual listenership = total_listeners_per_episode × 12
  const currentAnnualListenership = (kpis.total_listeners_per_episode || 0) * 12;
  
  // Build speaker breakdown array (9 podcasts per speaker = 3/month × 3 months)
  const speaker_breakdown = speakerNames && speakerNames.length > 0
    ? speakerNames.map(name => ({ speaker_name: name, goal: 9 }))
    : [{ speaker_name: client.name, goal: 9 }];
  
  return {
    quarter: nextQuarter, // Store the NEXT quarter directly for display
    intro_paragraph,
    strategic_focus_areas,
    talking_points_spotlight,
    closing_paragraph,
    next_quarter_kpis: {
      high_impact_podcasts_goal,
      listenership_goal,
      speaker_breakdown,
      current_total_reach: currentListenership,
      current_annual_listenership: currentAnnualListenership,
    },
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

// Scrape podcast metadata from iTunes API via edge function
async function scrapePodcastMetadata(applePodcastUrl: string): Promise<{
  coverArtUrl?: string;
  podcastName?: string;
  description?: string;
  primaryGenreName?: string;
  genres?: string[];
} | null> {
  try {
    const { data, error } = await supabase.functions.invoke('scrape-podcast-cover-art', {
      body: { apple_podcast_url: applePodcastUrl }
    });
    
    if (error) {
      console.error('Error scraping podcast metadata:', error);
      return null;
    }
    
    return {
      coverArtUrl: data?.coverArtUrl,
      podcastName: data?.podcastName,
      description: data?.description,
      primaryGenreName: data?.primaryGenreName,
      genres: data?.genres,
    };
  } catch (err) {
    console.error('Failed to scrape podcast metadata:', err);
    return null;
  }
}

// AI-powered batch podcast categorization
export async function generatePodcastCategories(
  podcasts: Array<{
    name: string;
    description?: string;
    apple_link?: string;
    cover_art_url?: string;
  }>,
  targetAudiences: string[],
  companyName?: string
): Promise<Array<{
  name: string;
  count: number;
  podcasts: Array<{
    show_title: string;
    description?: string;
    apple_podcast_link?: string;
    cover_art_url?: string;
  }>;
}>> {
  try {
    console.log(`[generatePodcastCategories] Generating AI categories for ${podcasts.length} podcasts`);
    
    const { data, error } = await supabase.functions.invoke('generate-podcast-categories', {
      body: { 
        podcasts: podcasts.map(p => ({
          name: p.name,
          description: p.description,
          apple_link: p.apple_link,
        })),
        targetAudiences,
        companyName 
      }
    });
    
    if (error) {
      console.error('Error generating podcast categories:', error);
      return [];
    }
    
    if (!data?.categories || !Array.isArray(data.categories)) {
      console.error('Invalid response from generate-podcast-categories');
      return [];
    }
    
    // Create a lookup map for podcast metadata
    const podcastLookup = new Map<string, typeof podcasts[0]>();
    podcasts.forEach(p => {
      podcastLookup.set(p.name.toLowerCase(), p);
    });
    
    // Transform AI response to include full podcast metadata
    const categoriesWithMetadata = data.categories.map((cat: { name: string; podcasts: string[] }) => {
      const podcastsWithMetadata = cat.podcasts.map(podcastName => {
        const metadata = podcastLookup.get(podcastName.toLowerCase());
        return {
          show_title: metadata?.name || podcastName,
          description: metadata?.description,
          apple_podcast_link: metadata?.apple_link,
          cover_art_url: metadata?.cover_art_url,
        };
      });
      
      return {
        name: cat.name,
        count: podcastsWithMetadata.length,
        podcasts: podcastsWithMetadata,
      };
    });
    
    // Sort by count descending
    categoriesWithMetadata.sort((a: { count: number }, b: { count: number }) => b.count - a.count);
    
    console.log(`[generatePodcastCategories] Generated ${categoriesWithMetadata.length} categories`);
    return categoriesWithMetadata;
    
  } catch (err) {
    console.error('Failed to generate podcast categories:', err);
    return [];
  }
}

// Calculate categories from booked podcasts using AI + target audiences
export async function calculateCategoriesFromBookedPodcasts(
  airtableRows: AirtableCSVRow[],
  dateRange: { start: Date; end: Date },
  targetAudiences: string[],
  companyName?: string
): Promise<ReportData['kpis']['top_categories']> {
  // Filter for booked podcasts with Apple Podcast links (based on date_booked)
  const canonicalizeApplePodcastUrl = (url: string) => {
    try {
      const u = new URL(url);
      u.search = '';
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      return url.split('?')[0].replace(/\/$/, '');
    }
  };

  const bookedRows = airtableRows.filter(r => {
    if (!r.date_booked || r.date_booked.trim() === '') return false;

    const bookedDate = parseAirtableDate(r.date_booked);
    if (!bookedDate) return false;

    // Must be within date range and have Apple Podcast link
    return (
      bookedDate >= dateRange.start &&
      bookedDate <= dateRange.end &&
      !!(r.apple_podcast_link && r.apple_podcast_link.trim() !== '')
    );
  });

  // Deduplicate: count unique podcasts (not rows/episodes)
  const seen = new Set<string>();
  const bookedPodcasts = bookedRows.filter(r => {
    const key = r.apple_podcast_link
      ? canonicalizeApplePodcastUrl(r.apple_podcast_link).toLowerCase()
      : normalizeTitle(r.podcast_name || '').toLowerCase();

    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[calculateCategoriesFromBookedPodcasts] Found ${bookedPodcasts.length} unique booked podcasts with Apple links`);

  if (bookedPodcasts.length === 0) {
    return [];
  }
  
  // Filter target audiences to only include clean, short category names
  // Remove talking points, long sentences, and other non-category content
  const cleanAudiences = targetAudiences.filter(audience => {
    if (!audience || typeof audience !== 'string') return false;
    const trimmed = audience.trim();
    // Skip empty strings
    if (trimmed.length === 0) return false;
    // Skip if it's too long (likely a talking point or description)
    if (trimmed.length > 80) return false;
    // Skip if it contains "Talking Points" or similar headers
    if (/talking\s*points/i.test(trimmed)) return false;
    // Skip if it starts with common talking point indicators
    if (/^(how|why|what|the|a\s+|building|from|beyond)/i.test(trimmed)) return false;
    // Skip if it contains bullet-like markers
    if (/^[\*\-\#\d+\.]+/.test(trimmed)) return false;
    // Skip if it looks like a sentence (has multiple verbs or long phrases)
    if (trimmed.split(' ').length > 12) return false;
    return true;
  });
  
  // If no target audiences provided, fall back to default categories
  const effectiveAudiences = cleanAudiences.length > 0 
    ? cleanAudiences 
    : ['Technology', 'Business', 'Industry', 'Leadership', 'Innovation'];
  
  console.log(`[calculateCategoriesFromBookedPodcasts] Using ${effectiveAudiences.length} clean target audiences for categorization (filtered from ${targetAudiences.length} total)`);
  
  // First, scrape metadata for each podcast in parallel batches
  const podcastsWithMetadata: Array<{
    name: string;
    description?: string;
    apple_link?: string;
    cover_art_url?: string;
  }> = [];
  
  // Process in batches of 5 for metadata scraping
  const metadataBatchSize = 5;
  for (let i = 0; i < bookedPodcasts.length; i += metadataBatchSize) {
    const batch = bookedPodcasts.slice(i, i + metadataBatchSize);
    
    const results = await Promise.all(
      batch.map(async (row) => {
        const metadata = await scrapePodcastMetadata(row.apple_podcast_link!);
        return {
          name: metadata?.podcastName || row.podcast_name,
          description: metadata?.description,
          apple_link: row.apple_podcast_link,
          cover_art_url: metadata?.coverArtUrl,
        };
      })
    );
    
    podcastsWithMetadata.push(...results);
    
    // Small delay between batches
    if (i + metadataBatchSize < bookedPodcasts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[calculateCategoriesFromBookedPodcasts] Scraped metadata for ${podcastsWithMetadata.length} podcasts`);
  
  // Now use the new batch AI categorization
  const categories = await generatePodcastCategories(
    podcastsWithMetadata,
    effectiveAudiences,
    companyName
  );
  
  console.log(`[calculateCategoriesFromBookedPodcasts] AI batch categorization complete: ${categories.length} categories found`);
  
  return categories.slice(0, 8);
}

// Calculate EMV for a single podcast
function calculateEMV(
  podcast: PodcastReportEntry,
  cpm: number = 50,
  speakingTimePct: number = 0.40
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
  
  // Speaking time: configurable % of episode duration
  const speaking_minutes = duration * speakingTimePct;
  
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

// Apply EMV calculations only to podcasts published within the report date range
function applyEMVCalculations(
  podcasts: PodcastReportEntry[],
  cpm: number = 50,
  speakingTimePct: number = 0.40,
  dateRange?: { start: Date; end: Date }
): PodcastReportEntry[] {
  return podcasts.map(podcast => {
    // Only calculate EMV for podcasts published within the reporting period
    if (dateRange && podcast.date_published) {
      const pubDate = new Date(podcast.date_published);
      if (pubDate < dateRange.start || pubDate > dateRange.end) {
        // Outside reporting period — skip EMV calculation
        return podcast;
      }
    }

    const emvData = calculateEMV(podcast, cpm, speakingTimePct);
    
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

// Merge data from ALL matching Airtable rows for a podcast
// This ensures we capture date_published even if it's on a different row than "podcast recording"
function mergeAllAirtableMatches(
  batchTitle: string,
  airtableRows: AirtableCSVRow[]
): Partial<AirtableCSVRow> | undefined {
  const normalizedBatch = normalizeTitle(batchTitle);
  
  // Find ALL matching rows (exact or partial)
  const allMatches = airtableRows.filter(row => {
    const normalized = normalizeTitle(row.podcast_name);
    return normalized === normalizedBatch || titlesMatch(batchTitle, row.podcast_name);
  });
  
  if (allMatches.length === 0) return undefined;
  
  if (allMatches.length > 1) {
    console.log('[mergeAllAirtableMatches] Found multiple matches for:', {
      batchTitle,
      matchCount: allMatches.length,
      matches: allMatches.map(m => ({ name: m.podcast_name, action: m.action, date_published: m.date_published })),
    });
  }
  
  // Merge all data - take first non-empty value for each field
  // Prioritize "podcast recording" action rows for action field
  const podcastRecordingRow = allMatches.find(r => getActionString(r.action).toLowerCase().includes('podcast recording'));
  
  return {
    podcast_name: allMatches[0].podcast_name,
    apple_podcast_link: allMatches.find(r => r.apple_podcast_link?.trim())?.apple_podcast_link,
    action: podcastRecordingRow?.action || allMatches[0].action,
    scheduled_date_time: allMatches.find(r => r.scheduled_date_time?.trim())?.scheduled_date_time,
    show_notes: allMatches.find(r => r.show_notes?.trim())?.show_notes,
    date_booked: allMatches.find(r => r.date_booked?.trim())?.date_booked,
    date_published: allMatches.find(r => r.date_published?.trim())?.date_published,
    link_to_episode: allMatches.find(r => r.link_to_episode?.trim())?.link_to_episode,
  };
}

// Find matching Airtable row using exact or partial title matching (returns merged data from all matches)
function findAirtableMatch(
  batchTitle: string,
  airtableRows: AirtableCSVRow[]
): Partial<AirtableCSVRow> | undefined {
  return mergeAllAirtableMatches(batchTitle, airtableRows);
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
  
  // Then, add Airtable-only podcasts (not matched to batch)
  // Include if: has "podcast recording" action OR has date_published
  airtableRows.forEach(airtableRow => {
    const normalizedAirtableTitle = normalizeTitle(airtableRow.podcast_name);
    
    // Check if already processed via exact or partial match
    const alreadyProcessed = processedAirtableTitles.has(normalizedAirtableTitle) ||
      Array.from(processedBatchTitles).some(batchTitle => 
        titlesMatch(airtableRow.podcast_name, batchTitle) || normalizedAirtableTitle === batchTitle
      );
    
    // Include if NOT already processed AND (has "podcast recording" action OR has date_published)
    const hasPodcastRecordingAction = getActionString(airtableRow.action).toLowerCase().includes('podcast recording');
    const hasPublishedDate = airtableRow.date_published && airtableRow.date_published.trim() !== '';
    
    if (!alreadyProcessed && (hasPodcastRecordingAction || hasPublishedDate)) {
      console.log('[mergePodcastData] Adding Airtable-only podcast:', {
        name: airtableRow.podcast_name,
        action: airtableRow.action,
        date_published: airtableRow.date_published,
        episode_link: airtableRow.link_to_episode,
      });
      
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
    interviewActions: airtableRows.filter(r => getActionString(r.action).toLowerCase().includes('podcast recording')).length,
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
    getActionString(r.action).toLowerCase().includes('podcast recording')
  ).length;
  
  const total_booked = airtableRows.filter(r => {
    // Only count "podcast recording" actions
    const isPodcastRecording = getActionString(r.action).toLowerCase().includes('podcast recording');
    if (!isPodcastRecording) return false;
    
    // Must have a date_booked
    if (!r.date_booked || r.date_booked.trim() === '') return false;
    
    // date_booked must be within the date range
    const bookedDate = parseAirtableDate(r.date_booked);
    if (!bookedDate) return false;
    
    return bookedDate >= dateRange.start && bookedDate <= dateRange.end;
  }).length;
  
  const total_published = airtableRows.filter(r => {
    if (!r.date_published || r.date_published.trim() === '') return false;
    const pubDate = parseAirtableDate(r.date_published);
    if (!pubDate) return false;
    return pubDate >= dateRange.start && pubDate <= dateRange.end;
  }).length;
  
  const total_recorded = airtableRows.filter(r => {
    const isPodcastRecording = getActionString(r.action).toLowerCase().includes('podcast recording');
    if (!isPodcastRecording) return false;
    if (!r.scheduled_date_time || r.scheduled_date_time.trim() === '') return false;
    const schedDate = parseAirtableDate(r.scheduled_date_time);
    if (!schedDate) return false;
    return schedDate >= dateRange.start && schedDate <= dateRange.end;
  }).length;
  
  const total_intro_calls = airtableRows.filter(r => {
    const isIntroCall = getActionString(r.action).toLowerCase().includes('intro call');
    if (!isIntroCall) return false;
    if (!r.scheduled_date_time || r.scheduled_date_time.trim() === '') return false;
    const schedDate = parseAirtableDate(r.scheduled_date_time);
    if (!schedDate) return false;
    return schedDate >= dateRange.start && schedDate <= dateRange.end;
  }).length;
  
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
    total_recorded,
    total_intro_calls,
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
  manualCompetitors?: { name: string; role: string; count: number; linkedin_url?: string; peer_reason?: string; episodeUrls?: string[]; episodes?: Array<{ title: string; podcast_name: string; air_date: string; role: string }> }[] | null,
  dateRange?: { start: Date; end: Date }
): ReportData['sov_analysis'] {
  // Count client interviews as episodes published within the report range.
  // NOTE: This intentionally mirrors the "Total Published" KPI logic.
  // NOTE: This intentionally mirrors the "Total Published" KPI logic.
  const clientCount = airtableRows.filter((row) => {
    if (!row.date_published || row.date_published.trim() === '') return false;
    if (dateRange) {
      const pubDate = parseAirtableDate(row.date_published);
      if (!pubDate) return false;
      return pubDate >= dateRange.start && pubDate <= dateRange.end;
    }
    return true;
  }).length;

  let competitors: ReportData['sov_analysis']['competitors'] = [];

  // Use manual input if provided
  if (manualCompetitors && manualCompetitors.length > 0) {
    competitors = manualCompetitors.map(c => ({
      name: c.name,
      role: c.role,
      peer_reason: c.peer_reason,
      linkedin_url: c.linkedin_url,
      interview_count: c.count,
      episodes: c.episodes,
      episode_urls: c.episodeUrls?.filter(u => u.trim()) || [],
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
  cpm: number = 50,
  speakingTimePct: number = 0.40,
  dateRange?: { start: Date; end: Date }
): PodcastReportEntry[] {
  if (!rephonicRows || rephonicRows.length === 0) return podcasts;
  
  // Create maps by both normalized name AND apple_podcast_link for matching
  const rephonicByName = new Map<string, RephonicCSVRow>();
  const rephonicByUrl = new Map<string, RephonicCSVRow>();
  rephonicRows.forEach(row => {
    if (row.podcast_name) {
      rephonicByName.set(normalizeTitle(row.podcast_name), row);
    }
    if (row.apple_podcast_link) {
      rephonicByUrl.set(row.apple_podcast_link.trim().toLowerCase(), row);
    }
  });
  
  console.log(`[applyRephonicEMVData] Matching ${podcasts.length} podcasts against ${rephonicRows.length} Rephonic rows`);
  let matchCount = 0;
  
  return podcasts.map(podcast => {
    let rephonicData: RephonicCSVRow | undefined;
    
    // Priority 1: Match by Apple Podcast URL (most reliable)
    if (podcast.apple_podcast_link) {
      rephonicData = rephonicByUrl.get(podcast.apple_podcast_link.trim().toLowerCase());
    }
    
    // Priority 2: Exact normalized title match
    if (!rephonicData) {
      const normalizedTitle = normalizeTitle(podcast.show_title);
      rephonicData = rephonicByName.get(normalizedTitle);
    }
    
    // Priority 3: Fuzzy title match
    if (!rephonicData) {
      for (const [key, value] of rephonicByName.entries()) {
        if (titlesMatch(podcast.show_title, value.podcast_name)) {
          rephonicData = value;
          break;
        }
      }
    }
    
    if (!rephonicData) {
      console.log(`[applyRephonicEMVData] No match for "${podcast.show_title}" (url: ${podcast.apple_podcast_link || 'none'})`);
      return podcast;
    }
    
    matchCount++;
    console.log(`[applyRephonicEMVData] Matched "${podcast.show_title}" → "${rephonicData.podcast_name}" (listeners=${rephonicData.listeners_per_episode}, monthly=${rephonicData.monthly_listens}, social=${rephonicData.social_reach})`);
    
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
    
    // Apply monthly listens if provided by Rephonic
    if (rephonicData.monthly_listens && !podcast.monthly_listens) {
      updatedPodcast.monthly_listens = rephonicData.monthly_listens;
    }
    
    // Apply social reach if provided by Rephonic
    if (rephonicData.social_reach && !podcast.social_reach) {
      updatedPodcast.social_reach = rephonicData.social_reach;
    }
    
    // Apply categories if provided by Rephonic
    if (rephonicData.categories && !podcast.categories) {
      updatedPodcast.categories = rephonicData.categories;
    }
    
    // Apply Apple Podcasts link if provided by Rephonic
    if (rephonicData.apple_podcast_link && !podcast.apple_podcast_link) {
      updatedPodcast.apple_podcast_link = rephonicData.apple_podcast_link;
    }
    
    // Only calculate EMV for podcasts published within the reporting period
    const isInDateRange = !dateRange || !updatedPodcast.date_published || (() => {
      const pubDate = new Date(updatedPodcast.date_published);
      return pubDate >= dateRange.start && pubDate <= dateRange.end;
    })();

    if (isInDateRange) {
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
        const emvData = calculateEMV(updatedPodcast, cpm, speakingTimePct);
        if (emvData) {
          Object.assign(updatedPodcast, emvData);
        }
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
  contentGapCsvProvided: boolean = false,
  speakingTimePct: number = 0.40,
  quarterlyNotes?: Array<{ quarter: string; notes: string }>
): Promise<ReportData> {
  
  // Step 1: Merge Batch + Airtable data by podcast title
  const mergedPodcasts = mergePodcastData(batchRows, airtableRows);
  
  // Step 2: Batch scrape episode durations
  const podcastsWithDuration = await batchScrapeDurations(mergedPodcasts);
  
  // Step 3: Apply EMV calculations (scraped data first)
  let podcastsWithEMV = applyEMVCalculations(podcastsWithDuration, cpm, speakingTimePct, dateRange);
  
  // Step 3a: Auto-fetch Podchaser metrics for podcasts with Apple Podcast links
  const applePodcastUrls = podcastsWithEMV
    .map(p => p.apple_podcast_link)
    .filter((url): url is string => !!url && url.trim() !== '');
  
  let podchaserRows: RephonicCSVRow[] = [];
  if (applePodcastUrls.length > 0) {
    try {
      podchaserRows = await fetchPodchaserMetrics(applePodcastUrls);
      console.log(`[generateReportFromMultipleCSVs] Rephonic returned ${podchaserRows.length} results`);
    } catch (err) {
      console.warn('[generateReportFromMultipleCSVs] Rephonic fetch failed, continuing without:', err);
    }
  }
  
  // Apply Podchaser data first (as baseline)
  if (podchaserRows.length > 0) {
    podcastsWithEMV = applyRephonicEMVData(podcastsWithEMV, podchaserRows, cpm, speakingTimePct, dateRange);
  }
  
  // Step 3b: Apply Rephonic CSV data if provided (overrides Podchaser data)
  if (rephonicRows && rephonicRows.length > 0) {
    podcastsWithEMV = applyRephonicEMVData(podcastsWithEMV, rephonicRows, cpm, speakingTimePct, dateRange);
  }
  
  // Step 4: Calculate enhanced KPIs (now includes total EMV)
  const kpis = calculateEnhancedKPIs(batchRows, airtableRows, podcastsWithEMV, dateRange);
  
  // Step 4a: Recalculate reach/social KPIs from enriched podcast entries (Podchaser + Rephonic)
  {
    const enrichedReach = podcastsWithEMV.reduce((sum, p) => {
      const monthly = p.monthly_listens || 0;
      return sum + (typeof monthly === 'number' ? monthly : parseFloat(String(monthly)) || 0);
    }, 0);
    const enrichedSocial = podcastsWithEMV.reduce((sum, p) => {
      const social = p.social_reach || 0;
      return sum + (typeof social === 'number' ? social : parseFloat(String(social)) || 0);
    }, 0);
    const enrichedListeners = podcastsWithEMV.reduce((sum, p) => {
      const listeners = p.listeners_per_episode || 0;
      return sum + (typeof listeners === 'number' ? listeners : parseFloat(String(listeners)) || 0);
    }, 0);
    if (enrichedReach > kpis.total_reach) kpis.total_reach = enrichedReach;
    if (enrichedSocial > kpis.total_social_reach) kpis.total_social_reach = enrichedSocial;
    if (enrichedListeners > (kpis.total_listeners_per_episode || 0)) kpis.total_listeners_per_episode = enrichedListeners;
  }
  
  // Step 4b: Calculate accurate categories from booked podcasts using AI + target audiences
  if (airtableRows.length > 0) {
    const targetAudiences = client.target_audiences || [];
    const accurateCategories = await calculateCategoriesFromBookedPodcasts(
      airtableRows, 
      dateRange, 
      targetAudiences,
      client.company || client.name
    );
    if (accurateCategories.length > 0) {
      kpis.top_categories = accurateCategories;
    }
  }
  
  // If Rephonic data provided with pre-calculated EMV totals, use that for total_emv
  if (rephonicRows && rephonicRows.length > 0) {
    const rephonicTotalEMV = calculateTotalRephonicEMV(rephonicRows);
    if (rephonicTotalEMV > 0) {
      kpis.total_emv = rephonicTotalEMV;
    }
  }
  
  // Step 5: Calculate SOV if provided (either CSV or manual)
  const sov_analysis = (sovRows || manualSOVCompetitors)
    ? calculateSOVAnalysis(airtableRows, sovRows, sovCompetitorName, manualSOVCompetitors, dateRange)
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
  
  // Generate next quarter strategy (single speaker)
  let next_quarter_strategy = generateNextQuarterStrategy(client, kpis, quarter, 1, [client.name]);
  
  // Enhance with AI-generated looking-ahead content
  try {
    const nextQuarter = getNextQuarter(quarter);
    const aiLookingAhead = await generateAITalkingPoints(
      [{
        name: client.name,
        title: client.title,
        company: client.company,
        talking_points: client.talking_points,
        target_audiences: client.target_audiences,
        campaign_strategy: client.campaign_strategy,
        professional_credentials: client.professional_credentials,
        guest_identity_tags: client.guest_identity_tags,
      }],
      nextQuarter,
      {
        total_booked: kpis.total_booked,
        total_published: kpis.total_published,
        total_reach: kpis.total_reach,
        top_categories: kpis.top_categories,
      },
      false,
      quarter,
      sortedPodcasts.map(p => ({ show_title: p.show_title, categories: p.categories, show_notes: p.show_notes })),
      quarterlyNotes,
      sov_analysis?.competitors?.map(c => ({ name: c.name, interview_count: c.interview_count, episode_urls: c.episode_urls }))
    );
    
    if (aiLookingAhead.talking_points_spotlight && aiLookingAhead.talking_points_spotlight.length > 0) {
      next_quarter_strategy.talking_points_spotlight = aiLookingAhead.talking_points_spotlight;
    }
    if (aiLookingAhead.intro_paragraph) {
      next_quarter_strategy.intro_paragraph = aiLookingAhead.intro_paragraph;
    }
    if (aiLookingAhead.strategic_focus_areas && aiLookingAhead.strategic_focus_areas.length > 0) {
      next_quarter_strategy.strategic_focus_areas = aiLookingAhead.strategic_focus_areas;
    }
    if (aiLookingAhead.closing_paragraph) {
      next_quarter_strategy.closing_paragraph = aiLookingAhead.closing_paragraph;
    }
  } catch (err) {
    console.error('AI looking-ahead generation failed, using default:', err);
  }
  
  // Generate AI pitch hooks for the speaker
  const aiHooks = await generatePitchHooksForSpeaker({
    name: client.name,
    title: client.title,
    company: client.company,
    target_audiences: client.target_audiences,
    talking_points: client.talking_points,
    campaign_strategy: client.campaign_strategy,
    professional_credentials: client.professional_credentials,
    guest_identity_tags: client.guest_identity_tags,
  });

  // Generate AI campaign overview using quarterly podcast data
  const aiOverview = await generateAICampaignOverview(
    {
      name: client.name,
      title: client.title,
      company: client.company,
      target_audiences: client.target_audiences,
      talking_points: client.talking_points,
      campaign_strategy: client.campaign_strategy,
      professional_credentials: client.professional_credentials,
    },
    sortedPodcasts.map(p => ({ show_title: p.show_title, categories: p.categories, show_notes: p.show_notes })),
    { total_booked: kpis.total_booked, total_published: kpis.total_published, total_reach: kpis.total_reach, top_categories: kpis.top_categories },
    quarter
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
    cpm,
    speaking_time_pct: speakingTimePct,
    kpis,
    campaign_overview: {
      strategy: aiOverview?.strategy || generateStrategyParagraph(client),
      executive_summary: executiveSummary,
      target_audiences: pickTopAudienceTags({
        strategyText: client.campaign_strategy,
        audiences: client.target_audiences,
        max: 3
      }),
      talking_points: aiOverview?.talking_points?.length ? aiOverview.talking_points : (client.talking_points?.slice(0, 3) || []),
      pitch_hooks: aiHooks.length > 0 
        ? [{ speaker_name: client.name, hooks: aiHooks }]
        : undefined,
    },
    podcasts: sortedPodcasts,
    intro_call_podcasts: buildIntroCallPodcasts(airtableRows, dateRange),
    sov_analysis,
    geo_analysis,
    content_gap_analysis,
    next_quarter_strategy,
    report_type: 'single',
    geo_csv_uploaded: geoCsvProvided,
    content_gap_csv_uploaded: contentGapCsvProvided,
  };
}

// Build intro call podcast entries from airtable rows
function buildIntroCallPodcasts(
  airtableRows: AirtableCSVRow[],
  dateRange: { start: Date; end: Date }
): PodcastReportEntry[] {
  return airtableRows
    .filter(r => {
      const isIntroCall = getActionString(r.action).toLowerCase().includes('intro call');
      if (!isIntroCall) return false;
      if (!r.scheduled_date_time || r.scheduled_date_time.trim() === '') return false;
      const schedDate = parseAirtableDate(r.scheduled_date_time);
      if (!schedDate) return false;
      return schedDate >= dateRange.start && schedDate <= dateRange.end;
    })
    .map(r => ({
      show_title: r.podcast_name || 'Unknown Podcast',
      verdict: 'Consider' as const,
      overall_score: 0,
      action: getActionString(r.action),
      scheduled_date_time: r.scheduled_date_time,
      apple_podcast_link: r.apple_podcast_link,
      date_booked: r.date_booked,
    }));
}
// Build published podcasts directly from airtable rows (same source as KPI)
function buildPublishedPodcastsFromAirtable(
  airtableRows: AirtableCSVRow[],
  mergedPodcasts: PodcastReportEntry[],
  dateRange?: { start: Date; end: Date }
): PodcastReportEntry[] {
  // Get airtable rows with date_published within the report date range
  const publishedAirtableRows = airtableRows.filter(r => {
    if (!r.date_published || r.date_published.trim() === '') return false;
    if (dateRange) {
      const pubDate = parseAirtableDate(r.date_published);
      if (!pubDate) return false;
      return pubDate >= dateRange.start && pubDate <= dateRange.end;
    }
    return true;
  });
  
  // For each published airtable row, find matching merged podcast or create new entry
  const publishedPodcasts: PodcastReportEntry[] = [];
  const processedTitles = new Set<string>();
  
  for (const airtableRow of publishedAirtableRows) {
    const normalizedTitle = normalizeTitle(airtableRow.podcast_name);
    
    // Skip duplicates
    if (processedTitles.has(normalizedTitle)) continue;
    processedTitles.add(normalizedTitle);
    
    // Try to find matching merged podcast for additional data (score, reach, etc.)
    const matchingMerged = mergedPodcasts.find(p => 
      normalizeTitle(p.show_title) === normalizedTitle || 
      titlesMatch(p.show_title, airtableRow.podcast_name)
    );
    
    if (matchingMerged) {
      // Use merged data but ensure airtable fields are set
      publishedPodcasts.push({
        ...matchingMerged,
        date_published: airtableRow.date_published,
        episode_link: airtableRow.link_to_episode || matchingMerged.episode_link,
        apple_podcast_link: airtableRow.apple_podcast_link || matchingMerged.apple_podcast_link,
        action: airtableRow.action || matchingMerged.action,
      });
    } else {
      // Create entry from airtable data alone
      publishedPodcasts.push({
        show_title: airtableRow.podcast_name,
        verdict: 'Not' as const,
        overall_score: 0,
        date_published: airtableRow.date_published,
        episode_link: airtableRow.link_to_episode,
        apple_podcast_link: airtableRow.apple_podcast_link,
        action: airtableRow.action,
        scheduled_date_time: airtableRow.scheduled_date_time,
        show_notes: airtableRow.show_notes,
        date_booked: airtableRow.date_booked,
        rationale_short: 'Published episode',
      });
    }
  }
  
  console.log('[buildPublishedPodcastsFromAirtable] Built published list:', {
    airtablePublishedCount: publishedAirtableRows.length,
    resultCount: publishedPodcasts.length,
    titles: publishedPodcasts.map(p => p.show_title),
  });
  
  return publishedPodcasts;
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
    const isPodcastRecording = getActionString(r.action).toLowerCase().includes('podcast recording');
    if (!isPodcastRecording) return false;
    
    // Must have a date_booked
    if (!r.date_booked || r.date_booked.trim() === '') return false;
    
    // date_booked must be within the date range
    const bookedDate = parseAirtableDate(r.date_booked);
    if (!bookedDate) return false;
    
    return bookedDate >= dateRange.start && bookedDate <= dateRange.end;
  }).length;
  
  const total_published = airtableRows.filter(r => {
    if (!r.date_published || r.date_published.trim() === '') return false;
    const pubDate = parseAirtableDate(r.date_published);
    if (!pubDate) return false;
    return pubDate >= dateRange.start && pubDate <= dateRange.end;
  }).length;
  
  const total_recorded = airtableRows.filter(r => {
    const isPodcastRecording = getActionString(r.action).toLowerCase().includes('podcast recording');
    if (!isPodcastRecording) return false;
    if (!r.scheduled_date_time || r.scheduled_date_time.trim() === '') return false;
    const schedDate = parseAirtableDate(r.scheduled_date_time);
    if (!schedDate) return false;
    return schedDate >= dateRange.start && schedDate <= dateRange.end;
  }).length;

  const total_intro_calls = airtableRows.filter(r => {
    const isIntroCall = getActionString(r.action).toLowerCase().includes('intro call');
    if (!isIntroCall) return false;
    if (!r.scheduled_date_time || r.scheduled_date_time.trim() === '') return false;
    const schedDate = parseAirtableDate(r.scheduled_date_time);
    if (!schedDate) return false;
    return schedDate >= dateRange.start && schedDate <= dateRange.end;
  }).length;
  
  const total_emv = podcasts.reduce((sum, p) => sum + (p.true_emv || 0), 0);
  
  return {
    total_booked,
    total_published,
    total_recorded,
    total_intro_calls,
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
  contentGapCsvProvided: boolean = false,
  speakingTimePct: number = 0.40,
  quarterlyNotes?: Array<{ quarter: string; notes: string }>
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
    let podcastsWithEMV = applyEMVCalculations(podcastsWithDuration, cpm, speakingTimePct, dateRange);
    
    // Auto-fetch Podchaser metrics for podcasts with Apple Podcast links
    const speakerAppleUrls = podcastsWithEMV
      .map(p => p.apple_podcast_link)
      .filter((url): url is string => !!url && url.trim() !== '');
    
    if (speakerAppleUrls.length > 0) {
      try {
        const speakerPodchaserRows = await fetchPodchaserMetrics(speakerAppleUrls);
        if (speakerPodchaserRows.length > 0) {
          podcastsWithEMV = applyRephonicEMVData(podcastsWithEMV, speakerPodchaserRows, cpm, speakingTimePct);
        }
      } catch (err) {
        console.warn(`[generateMultiSpeakerReport] Podchaser fetch failed for ${speaker.name}:`, err);
      }
    }
    
    // Apply Rephonic CSV data if provided (overrides Podchaser)
    if (rephonicRows && rephonicRows.length > 0) {
      podcastsWithEMV = applyRephonicEMVData(podcastsWithEMV, rephonicRows, cpm, speakingTimePct);
    }
    
    // Build published podcasts directly from airtable (same source as KPI)
    // This ensures the carousel matches the KPI count exactly
    const publishedPodcasts = buildPublishedPodcastsFromAirtable(airtableRows, podcastsWithEMV, dateRange);
    
    // Calculate per-speaker KPIs
    const speakerKpis = calculateSpeakerKPIs(batchRows, airtableRows, podcastsWithEMV, dateRange);
    
    // Recalculate reach/social from enriched podcast entries (Podchaser + Rephonic)
    {
      const enrichedReach = podcastsWithEMV.reduce((sum, p) => sum + (typeof p.monthly_listens === 'number' ? p.monthly_listens : 0), 0);
      const enrichedSocial = podcastsWithEMV.reduce((sum, p) => sum + (typeof p.social_reach === 'number' ? p.social_reach : 0), 0);
      const enrichedListeners = podcastsWithEMV.reduce((sum, p) => sum + (typeof p.listeners_per_episode === 'number' ? p.listeners_per_episode : 0), 0);
      if (enrichedReach > speakerKpis.total_reach) speakerKpis.total_reach = enrichedReach;
      if (enrichedSocial > speakerKpis.total_social_reach) speakerKpis.total_social_reach = enrichedSocial;
    }
    
    speakerBreakdowns.push({
      speaker_id: speaker.id,
      speaker_name: speaker.name,
      speaker_title: speaker.title || undefined,
      speaker_headshot_url: speaker.headshot_url || undefined,
      airtable_embed_url: speaker.airtable_embed_url || undefined,
      // Include strategy insights from speaker profile
      campaign_strategy: speaker.campaign_strategy || undefined,
      target_audiences: speaker.target_audiences || [],
      talking_points: speaker.talking_points || [],
      professional_credentials: speaker.professional_credentials || [],
      kpis: speakerKpis,
      // Use published podcasts for carousel (matches KPI exactly)
      podcasts: publishedPodcasts,
    });
    
    // Aggregate for company-level calculations
    allPodcasts = [...allPodcasts, ...podcastsWithEMV];
    allBatchRows = [...allBatchRows, ...batchRows];
    allAirtableRows = [...allAirtableRows, ...airtableRows];
  }
  
  // Calculate aggregated company KPIs
  const aggregatedKpis = calculateAggregatedKPIs(speakerBreakdowns, allBatchRows, allAirtableRows, allPodcasts);
  
  // Calculate accurate categories from booked podcasts using AI + target audiences
  if (allAirtableRows.length > 0) {
    // Combine target audiences from all speakers
    const allTargetAudiences = [...new Set(
      speakerData.flatMap(sd => sd.speaker.target_audiences || [])
    )];
    const accurateCategories = await calculateCategoriesFromBookedPodcasts(
      allAirtableRows, 
      dateRange,
      allTargetAudiences,
      company.name
    );
    if (accurateCategories.length > 0) {
      aggregatedKpis.top_categories = accurateCategories;
    }
  }
  
  // If Rephonic data provided with pre-calculated EMV totals, use that for total_emv (combined for all speakers)
  if (rephonicRows && rephonicRows.length > 0) {
    const rephonicTotalEMV = calculateTotalRephonicEMV(rephonicRows);
    if (rephonicTotalEMV > 0) {
      aggregatedKpis.total_emv = rephonicTotalEMV;
    }
  }
  
  // Calculate company-level SOV
  const sov_analysis = (sovRows || manualSOVCompetitors)
    ? calculateSOVAnalysis(allAirtableRows, sovRows, null, manualSOVCompetitors, dateRange)
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
  
  // Generate next quarter strategy (multi-speaker: pass speaker count and names)
  const speakerNames = speakerData.map(s => s.speaker.name);
  let next_quarter_strategy = generateNextQuarterStrategy(companyClient, aggregatedKpis, quarter, speakerData.length, speakerNames);
  
  // Enhance with AI-generated looking-ahead content (multi-speaker)
  const allPodcastsForLookingAhead = speakerBreakdowns.flatMap(s => 
    (s.podcasts || []).map(p => ({ show_title: p.show_title, categories: p.categories, show_notes: p.show_notes }))
  );
  try {
    const speakersForAI = speakerData.map(s => ({
      name: s.speaker.name,
      title: s.speaker.title,
      company: company.name,
      talking_points: s.speaker.talking_points,
      target_audiences: s.speaker.target_audiences,
      campaign_strategy: s.speaker.campaign_strategy,
      professional_credentials: s.speaker.professional_credentials,
      guest_identity_tags: s.speaker.guest_identity_tags,
    }));
    
    const nextQuarter = getNextQuarter(quarter);
    const aiLookingAhead = await generateAITalkingPoints(
      speakersForAI,
      nextQuarter,
      {
        total_booked: aggregatedKpis.total_booked,
        total_published: aggregatedKpis.total_published,
        total_reach: aggregatedKpis.total_reach,
        top_categories: aggregatedKpis.top_categories,
      },
      true,
      quarter,
      allPodcastsForLookingAhead,
      quarterlyNotes,
      sov_analysis?.competitors?.map(c => ({ name: c.name, interview_count: c.interview_count, episode_urls: c.episode_urls }))
    );
    
    if (aiLookingAhead.speaker_talking_points_spotlight && aiLookingAhead.speaker_talking_points_spotlight.length > 0) {
      next_quarter_strategy.speaker_talking_points_spotlight = aiLookingAhead.speaker_talking_points_spotlight;
      next_quarter_strategy.talking_points_spotlight = [];
    }
    if (aiLookingAhead.intro_paragraph) {
      next_quarter_strategy.intro_paragraph = aiLookingAhead.intro_paragraph;
    }
    if (aiLookingAhead.strategic_focus_areas && aiLookingAhead.strategic_focus_areas.length > 0) {
      next_quarter_strategy.strategic_focus_areas = aiLookingAhead.strategic_focus_areas;
    }
    if (aiLookingAhead.closing_paragraph) {
      next_quarter_strategy.closing_paragraph = aiLookingAhead.closing_paragraph;
    }
  } catch (err) {
    console.error('AI looking-ahead generation failed, using default:', err);
  }
  
  // Generate AI pitch hooks for each speaker
  const pitchHooksPromises = speakerData.map(async (s) => {
    const hooks = await generatePitchHooksForSpeaker({
      name: s.speaker.name,
      title: s.speaker.title,
      company: company.name,
      target_audiences: s.speaker.target_audiences,
      talking_points: s.speaker.talking_points,
      campaign_strategy: s.speaker.campaign_strategy,
      professional_credentials: s.speaker.professional_credentials,
      guest_identity_tags: s.speaker.guest_identity_tags,
    });
    return { speaker_name: s.speaker.name, hooks };
  });
  
  const pitch_hooks = await Promise.all(pitchHooksPromises);
  const validPitchHooks = pitch_hooks.filter(ph => ph.hooks.length > 0);

  // Generate AI campaign overview for multi-speaker using all podcasts
  const allPodcastsForAI = speakerBreakdowns.flatMap(s => 
    (s.podcasts || []).map(p => ({ show_title: p.show_title, categories: p.categories, show_notes: p.show_notes }))
  );
  const primarySpeaker = speakerData[0]?.speaker;
  const aiOverviewMulti = await generateAICampaignOverview(
    {
      name: company.name,
      company: company.name,
      target_audiences: primarySpeaker?.target_audiences,
      talking_points: primarySpeaker?.talking_points,
      campaign_strategy: primarySpeaker?.campaign_strategy,
      professional_credentials: primarySpeaker?.professional_credentials,
    },
    allPodcastsForAI,
    { total_booked: aggregatedKpis.total_booked, total_published: aggregatedKpis.total_published, total_reach: aggregatedKpis.total_reach, top_categories: aggregatedKpis.top_categories },
    quarter
  );

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
    speaking_time_pct: speakingTimePct,
    kpis: aggregatedKpis,
    campaign_overview: {
      strategy: aiOverviewMulti?.strategy || generateCompanyStrategyParagraph(company.name, speakerBreakdowns),
      executive_summary: executiveSummary,
      target_audiences: speakerData[0]?.speaker.target_audiences?.slice(0, 3) || [],
      talking_points: aiOverviewMulti?.talking_points?.length ? aiOverviewMulti.talking_points : (speakerData[0]?.speaker.talking_points?.slice(0, 3) || []),
      pitch_hooks: validPitchHooks.length > 0 ? validPitchHooks : undefined,
    },
    podcasts: allPodcasts.sort((a, b) => b.overall_score - a.overall_score),
    intro_call_podcasts: buildIntroCallPodcasts(allAirtableRows, dateRange),
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
  const total_recorded = speakerBreakdowns.reduce((sum, s) => sum + (s.kpis.total_recorded || 0), 0);
  const total_intro_calls = speakerBreakdowns.reduce((sum, s) => sum + (s.kpis.total_intro_calls || 0), 0);
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
    getActionString(r.action).toLowerCase().includes('podcast recording')
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
    total_recorded,
    total_intro_calls,
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
    .map(s => `${extractFirstName(s.speaker_name)} (${s.kpis.total_booked} bookings)`)
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

// Type for CSV update data
interface UpdatedCSVData {
  batchData?: BatchCSVRow[] | null;
  airtableData?: AirtableCSVRow[] | null;
  sovData?: SOVCSVRow[] | null;
  geoData?: GEOCSVRow[] | null;
  contentGapData?: ContentGapCSVRow[] | null;
  rephonicData?: RephonicCSVRow[] | null;
}

type CSVType = 'batch' | 'airtable' | 'sov' | 'geo' | 'content_gap' | 'rephonic';

// Minimal client info needed for AI categorization during CSV updates
interface UpdateClientInfo {
  target_audiences?: string[];
  company_name?: string;
}

/**
 * Merge updated CSV data into an existing report, preserving manually edited fields.
 * Only recalculates data for the CSV types that were updated.
 */
export async function mergeUpdatedReportData(
  existingReport: ReportData,
  newData: UpdatedCSVData,
  updatedCSVTypes: CSVType[],
  dateRangeOverride?: { start: Date; end: Date },
  clientInfo?: UpdateClientInfo
): Promise<ReportData> {
  // Clone the existing report to avoid mutation
  const updatedReport = JSON.parse(JSON.stringify(existingReport)) as ReportData;
  
  // Preserve these fields regardless of what's updated
  const preservedFields = {
    target_podcasts: existingReport.target_podcasts,
    highlight_clips: existingReport.highlight_clips,
    visibleSections: (existingReport as any).visibleSections,
  };
  
  const cpm = existingReport.cpm || 50;
  const dateRange = dateRangeOverride ?? (existingReport.date_range ? {
    start: new Date(existingReport.date_range.start),
    end: new Date(existingReport.date_range.end)
  } : {
    start: new Date(),
    end: new Date()
  });
  
  // Determine what data to use for recalculations
  // If batch or airtable is updated, we need to recalculate podcasts and KPIs
  const needsPodcastRecalc = updatedCSVTypes.includes('batch') || updatedCSVTypes.includes('airtable');
  
  if (needsPodcastRecalc) {
    // Get batch and airtable data (use new if provided, otherwise would need original which we don't have)
    // For partial updates, we only support updating with the new data
    if (newData.batchData && newData.airtableData) {
      // Full recalculation with both new CSVs
      const mergedPodcasts = mergePodcastData(newData.batchData, newData.airtableData);
      const podcastsWithDuration = await batchScrapeDurations(mergedPodcasts);
      let podcastsWithEMV = applyEMVCalculations(podcastsWithDuration, cpm, existingReport.speaking_time_pct || 0.40, dateRange);
      
      // Apply rephonic data if provided or exists
      if (newData.rephonicData && newData.rephonicData.length > 0) {
        podcastsWithEMV = applyRephonicEMVData(podcastsWithEMV, newData.rephonicData, cpm, existingReport.speaking_time_pct || 0.40);
      }
      
      updatedReport.podcasts = podcastsWithEMV;
      
      // Recalculate KPIs
      const newKpis = calculateEnhancedKPIs(newData.batchData, newData.airtableData, podcastsWithEMV, dateRange);
      
      // Check if existing categories look valid (short names, have podcast details)
      // Categories with very long names (>80 chars) are likely corrupted from bad target_audiences
      const existingHasValidCategories = existingReport.kpis.top_categories?.some(
        cat => cat.podcasts && cat.podcasts.length > 0 && cat.name.length <= 80
      );
      const existingHasCorruptedCategories = existingReport.kpis.top_categories?.some(
        cat => cat.name.length > 80
      );
      
      if (existingHasValidCategories && !existingHasCorruptedCategories) {
        // Keep existing categories - they look clean
        console.log('[mergeUpdatedReportData] Preserving existing valid categories with podcast details');
        newKpis.top_categories = existingReport.kpis.top_categories;
      } else if (newKpis.top_categories.length === 0) {
        // Fallback to existing if new calculation returned nothing
        newKpis.top_categories = existingReport.kpis.top_categories;
      }
      // Otherwise use new categories (existing were corrupted or empty)
      
      updatedReport.kpis = newKpis;
      
      // Recalculate SOV if we have the data
      if (newData.sovData || existingReport.sov_analysis) {
        const sovAnalysis = calculateSOVAnalysis(
          newData.airtableData,
          newData.sovData || null,
          null,
          null,
          dateRange
        );
        if (sovAnalysis) {
          updatedReport.sov_analysis = sovAnalysis;
          updatedReport.kpis.sov_percentage = sovAnalysis.client_percentage;
        }
      }
    } else if (newData.batchData && updatedCSVTypes.includes('batch')) {
      // Only batch updated - limited recalculation
      // We can update basic stats but not full podcast merging without airtable
      console.log('[mergeUpdatedReportData] Batch-only update - limited recalculation');
  } else if (newData.airtableData && updatedCSVTypes.includes('airtable')) {
      // Only airtable updated - update booking/publishing stats
      console.log('[mergeUpdatedReportData] Airtable-only update - updating booking stats');
      
      // Update published/booked counts
      const publishedCount = newData.airtableData.filter(r => 
        r.date_published && r.date_published.trim() !== ''
      ).length;
      
      // Booked count: only "podcast recording" actions with date_booked within the date range
      const bookedCount = newData.airtableData.filter(r => {
        // Only count "podcast recording" actions
        const isPodcastRecording = getActionString(r.action).toLowerCase().includes('podcast recording');
        if (!isPodcastRecording) return false;
        
        // Must have a date_booked
        if (!r.date_booked || r.date_booked.trim() === '') return false;
        
        // date_booked must be within the date range
        const bookedDate = parseAirtableDate(r.date_booked);
        if (!bookedDate) return false;
        
        return bookedDate >= dateRange.start && bookedDate <= dateRange.end;
      }).length;
      
      const interviewCount = newData.airtableData.filter(r => 
        getActionString(r.action).toLowerCase().includes('podcast recording')
      ).length;
      
      updatedReport.kpis.total_published = publishedCount;
      updatedReport.kpis.total_booked = bookedCount;
      updatedReport.kpis.total_interviews = interviewCount;
      
      // Update episode links in existing podcasts
      newData.airtableData.forEach(airtableRow => {
        const matchingPodcast = updatedReport.podcasts.find(p => 
          titlesMatch(p.show_title, airtableRow.podcast_name)
        );
        if (matchingPodcast) {
          matchingPodcast.episode_link = airtableRow.link_to_episode || matchingPodcast.episode_link;
          matchingPodcast.date_published = airtableRow.date_published || matchingPodcast.date_published;
          matchingPodcast.date_booked = airtableRow.date_booked || matchingPodcast.date_booked;
          matchingPodcast.action = airtableRow.action || matchingPodcast.action;
        }
      });
    }
  }
  
  // Update SOV analysis if SOV CSV was updated
  if (updatedCSVTypes.includes('sov') && newData.sovData) {
    // Need airtable data for client interview count
    const airtableRows = newData.airtableData || [];
    const sovAnalysis = calculateSOVAnalysis(airtableRows, newData.sovData, null, null, dateRange);
    if (sovAnalysis) {
      updatedReport.sov_analysis = sovAnalysis;
      updatedReport.kpis.sov_percentage = sovAnalysis.client_percentage;
    }
  }
  
  // Update GEO analysis if GEO CSV was updated
  if (updatedCSVTypes.includes('geo') && newData.geoData) {
    updatedReport.geo_csv_uploaded = true;
    const geoAnalysis = calculateGEOAnalysis(newData.geoData);
    if (geoAnalysis) {
      updatedReport.geo_analysis = geoAnalysis;
      updatedReport.kpis.geo_score = geoAnalysis.geo_score;
    } else {
      updatedReport.geo_analysis = undefined;
    }
  }
  
  // Update Content Gap analysis if Content Gap CSV was updated
  if (updatedCSVTypes.includes('content_gap') && newData.contentGapData) {
    updatedReport.content_gap_csv_uploaded = true;
    const contentGapAnalysis = calculateContentGapAnalysis(newData.contentGapData);
    if (contentGapAnalysis) {
      // Preserve existing AI recommendations
      if (existingReport.content_gap_analysis?.ai_recommendations) {
        contentGapAnalysis.ai_recommendations = existingReport.content_gap_analysis.ai_recommendations;
      }
      updatedReport.content_gap_analysis = contentGapAnalysis;
    } else {
      updatedReport.content_gap_analysis = undefined;
    }
  }
  
  // Update EMV data if Rephonic CSV was updated (without full podcast recalc)
  if (updatedCSVTypes.includes('rephonic') && newData.rephonicData && !needsPodcastRecalc) {
    updatedReport.podcasts = applyRephonicEMVData(updatedReport.podcasts, newData.rephonicData, cpm, existingReport.speaking_time_pct || 0.40);
    
    // Recalculate total EMV
    const totalEMV = updatedReport.podcasts.reduce((sum, p) => sum + (p.true_emv || 0), 0);
    updatedReport.kpis.total_emv = totalEMV;
  }
  
  // Restore preserved fields
  updatedReport.target_podcasts = preservedFields.target_podcasts;
  updatedReport.highlight_clips = preservedFields.highlight_clips;
  (updatedReport as any).visibleSections = preservedFields.visibleSections;
  
  return updatedReport;
}
