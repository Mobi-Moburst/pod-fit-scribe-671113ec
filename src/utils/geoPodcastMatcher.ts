import { GEOCSVRow, AirtableCSVRow } from '@/types/csv';
import { GEOPodcastMatch } from '@/types/reports';

const STOP_WORDS = new Set([
  // Common English
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'be', 'as', 'was', 'are',
  'its', 'your', 'my', 'our', 'their', 'this', 'that', 'get', 'how',
  'what', 'why', 'who', 'when', 'where', 'real', 'life',
  // Podcast-specific noise words
  'podcast', 'show', 'radio', 'cast', 'episode', 'episodes', 'daily',
  'weekly', 'talk', 'talks', 'interview', 'interviews',
]);

// Words so common in this GEO dataset they'd cause too many false positives
const DATASET_NOISE = new Set([
  'marketing', 'digital', 'agency', 'agencies', 'mobile', 'growth',
  'app', 'apps', 'business', 'brand', 'brands', 'media', 'social',
  'strategy', 'strategies', 'tech', 'technology', 'ai', 'pr',
]);

function extractSignificantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/[\s\-_\/]+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t) && !DATASET_NOISE.has(t));
}

function extractUrlTokens(url: string): string[] {
  try {
    const parsed = new URL(url);
    return extractSignificantTokens(parsed.pathname + ' ' + parsed.hostname);
  } catch {
    return extractSignificantTokens(url);
  }
}

function extractAppleId(url: string): string | null {
  const match = url.match(/\/id(\d+)/);
  return match ? match[1] : null;
}

function scoreUrlMatch(podcastTokens: string[], url: string): number {
  const urlTokens = extractUrlTokens(url);
  const matched = podcastTokens.filter(t => urlTokens.includes(t));

  if (matched.length === 0) return 0;

  // Require at least 2 matches, OR 1 long/rare token (>= 7 chars)
  const hasLongToken = matched.some(t => t.length >= 7);
  if (matched.length < 2 && !hasLongToken) return 0;

  // Score: ratio of podcast tokens matched, bonus for long tokens
  const ratio = matched.length / podcastTokens.length;
  const lengthBonus = matched.reduce((acc, t) => acc + (t.length >= 7 ? 0.2 : 0), 0);
  return Math.min(ratio + lengthBonus, 1);
}

function scorePromptMatch(podcastTokens: string[], promptText: string): number {
  const promptTokens = extractSignificantTokens(promptText);
  const matched = podcastTokens.filter(t => promptTokens.includes(t));
  // Require at least 2 distinctive tokens in the prompt
  if (matched.length < 2) return 0;
  return matched.length / podcastTokens.length;
}

export function matchPodcastsToGEO(
  airtableRows: AirtableCSVRow[],
  geoRows: GEOCSVRow[]
): GEOPodcastMatch[] {
  if (!airtableRows.length || !geoRows.length) return [];

  // Deduplicate airtable rows by podcast name (one entry per show)
  const podcastMap = new Map<string, AirtableCSVRow>();
  airtableRows.forEach(row => {
    const key = row.podcast_name.toLowerCase().trim();
    if (!podcastMap.has(key)) {
      podcastMap.set(key, row);
    }
  });

  const results: GEOPodcastMatch[] = [];

  podcastMap.forEach(airtableRow => {
    const podcastTokens = extractSignificantTokens(airtableRow.podcast_name);
    if (podcastTokens.length === 0) return;

    const appleId = airtableRow.apple_podcast_link
      ? extractAppleId(airtableRow.apple_podcast_link)
      : null;

    type MatchEntry = GEOPodcastMatch['matched_entries'][number];
    const highMatches: MatchEntry[] = [];
    const mediumMatches: MatchEntry[] = [];
    const lowMatches: MatchEntry[] = [];

    geoRows.forEach(geoRow => {
      const url = geoRow.uri || '';
      const entry: Omit<MatchEntry, 'match_type'> = {
        url,
        domain: geoRow.domain,
        llm: geoRow.llm,
        topic: geoRow.topic_name,
        prompt: geoRow.prompt_text,
      };

      // HIGH: Apple Podcast URL with matching Apple ID in the GEO data
      if (appleId && url.includes('podcasts.apple.com') && url.includes(`/id${appleId}`)) {
        highMatches.push({ ...entry, match_type: 'apple_id' });
        return;
      }

      // MEDIUM: significant podcast name tokens found in the URL slug
      const urlScore = scoreUrlMatch(podcastTokens, url);
      if (urlScore > 0) {
        mediumMatches.push({ ...entry, match_type: 'url_slug' });
        return;
      }

      // LOW: significant podcast name tokens found in the prompt text
      const promptScore = scorePromptMatch(podcastTokens, geoRow.prompt_text || '');
      if (promptScore > 0) {
        lowMatches.push({ ...entry, match_type: 'prompt_text' });
      }
    });

    const totalAppearances = highMatches.length + mediumMatches.length + lowMatches.length;
    if (totalAppearances === 0) return;

    const confidence: GEOPodcastMatch['confidence'] =
      highMatches.length > 0 ? 'high' : mediumMatches.length > 0 ? 'medium' : 'low';

    const matchReason =
      confidence === 'high'
        ? 'Apple Podcast ID found in AI-cited sources'
        : confidence === 'medium'
          ? 'Podcast name appears in URLs cited by AI engines'
          : 'Podcast keywords appear in tracked search prompts';

    // Cap entries per tier to keep report payload manageable
    const matchedEntries: MatchEntry[] = [
      ...highMatches.slice(0, 10),
      ...mediumMatches.slice(0, 10),
      ...lowMatches.slice(0, 5),
    ];

    results.push({
      podcast_name: airtableRow.podcast_name,
      apple_podcast_link: airtableRow.apple_podcast_link,
      confidence,
      match_reason: matchReason,
      matched_entries: matchedEntries,
      total_appearances: totalAppearances,
    });
  });

  // Sort: high → medium → low, then by total_appearances desc
  const order = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => {
    if (a.confidence !== b.confidence) return order[a.confidence] - order[b.confidence];
    return b.total_appearances - a.total_appearances;
  });

  return results;
}
