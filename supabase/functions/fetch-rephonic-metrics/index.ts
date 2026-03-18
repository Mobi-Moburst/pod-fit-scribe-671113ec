import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const REPHONIC_API_URL = 'https://api.rephonic.com';

function extractAppleId(url: string): string | null {
  const match = url.match(/\/id(\d+)/i);
  return match ? match[1] : null;
}

// Extract a clean podcast name from an Apple Podcast URL for search
function extractNameFromAppleUrl(url: string): string | null {
  // Pattern: /podcast/some-podcast-name/id123
  const match = url.match(/\/podcast\/([^/]+)\/id/i);
  if (match) {
    return match[1].replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return null;
}

async function lookupApplePodcastName(appleId: string): Promise<string | null> {
  const response = await fetch(`https://itunes.apple.com/lookup?id=${appleId}&entity=podcast`);
  if (!response.ok) return null;
  const data = await response.json();
  const result = data?.results?.[0];
  return result?.collectionName || result?.trackName || null;
}

// Search Rephonic for a podcast by name using the titles mode
async function searchPodcast(query: string, apiKey: string): Promise<any | null> {
  const params = new URLSearchParams({ query, mode: 'titles', per_page: '5' });
  const url = `${REPHONIC_API_URL}/api/search/podcasts/?${params}`;
  console.log(`[searchPodcast] Searching: ${url}`);

  const response = await fetch(url, {
    headers: { 'X-Rephonic-Api-Key': apiKey },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Rephonic search error [${response.status}]: ${errText}`);
    if (response.status === 429) throw new Error('Rate limited');
    return null;
  }

  const data = await response.json();
  // Response format: { podcasts: [...], count: N, page: 1, ... }
  const results = data?.podcasts || [];
  console.log(`[searchPodcast] Found ${results.length} results for "${query}"`);
  return results.length > 0 ? results[0] : null;
}

// Get podcast details by Rephonic slug/id
async function getPodcastBySlug(slug: string, apiKey: string): Promise<any | null> {
  const url = `${REPHONIC_API_URL}/api/podcasts/${slug}/`;
  console.log(`[getPodcastBySlug] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: { 'X-Rephonic-Api-Key': apiKey },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Rephonic detail error for ${slug} [${response.status}]: ${errText}`);
    return null;
  }

  const data = await response.json();
  // The detail endpoint wraps data in a "podcast" key
  const podcast = data?.podcast || data;
  console.log(`[getPodcastBySlug] name=${podcast.name}, downloads_per_episode=${podcast.downloads_per_episode}, social_reach=${podcast.social_reach}`);
  return podcast;
}

// Normalize Rephonic response to our standard metrics format
function normalizeMetrics(podcast: any): {
  podcast_name: string;
  listeners_per_episode: number;
  monthly_listens: number;
  social_reach: number;
  categories: string;
  description: string;
} {
  const name = podcast.name || podcast.short_name || '';
  const listeners = podcast.downloads_per_episode || 0;
  const weekly = podcast.est_weekly_downloads || 0;
  const monthly = weekly > 0 ? weekly * 4 : listeners * 4;

  const socialReach = podcast.social_reach || 0;

  // Categories/genres
  let categories = '';
  if (Array.isArray(podcast.genres)) {
    categories = podcast.genres.filter(Boolean).join(', ');
  }

  return {
    podcast_name: name,
    listeners_per_episode: listeners,
    monthly_listens: monthly,
    social_reach: socialReach,
    categories,
    description: podcast.description || podcast.summary || '',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('REPHONIC_API_KEY');
    if (!apiKey) {
      throw new Error('REPHONIC_API_KEY not configured');
    }

    const { apple_podcast_urls, podcast_names } = await req.json();

    // Support both lookup modes: by Apple URL or by podcast name
    const lookups: Array<{ key: string; name: string | null }> = [];

    if (apple_podcast_urls && Array.isArray(apple_podcast_urls)) {
      for (const url of apple_podcast_urls) {
        const name = extractNameFromAppleUrl(url);
        lookups.push({ key: url, name });
      }
    }

    if (podcast_names && Array.isArray(podcast_names)) {
      for (const name of podcast_names) {
        lookups.push({ key: name, name });
      }
    }

    if (lookups.length === 0) {
      return new Response(
        JSON.stringify({ error: 'apple_podcast_urls or podcast_names array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-rephonic-metrics] Processing ${lookups.length} lookups`);

    const results: Record<string, any> = {};

    for (let i = 0; i < lookups.length; i++) {
      const lookup = lookups[i];

      try {
        const searchName = lookup.name;
        if (!searchName) {
          results[lookup.key] = { error: 'Could not extract podcast name from URL' };
          continue;
        }

        const searchResult = await searchPodcast(searchName, apiKey);
        if (!searchResult) {
          results[lookup.key] = { error: 'Podcast not found on Rephonic' };
          continue;
        }

        // The search result already contains full metrics (downloads_per_episode, social_reach, etc.)
        // Use slug/id to get detailed info if needed
        let podcastData = searchResult;
        const slug = searchResult.id;

        if (slug) {
          const detailed = await getPodcastBySlug(slug, apiKey);
          if (detailed) {
            podcastData = detailed;
          }
        }

        const metrics = normalizeMetrics(podcastData);
        results[lookup.key] = metrics;

        console.log(`Found: "${metrics.podcast_name}" — listeners=${metrics.listeners_per_episode}, monthly=${metrics.monthly_listens}, social=${metrics.social_reach}`);
      } catch (err) {
        if (err.message === 'Rate limited') {
          console.warn('[fetch-rephonic-metrics] Rate limited, waiting 2s...');
          await new Promise(r => setTimeout(r, 2000));
          i--; // Retry this lookup
          continue;
        }
        console.error(`Error for ${lookup.key}:`, err);
        results[lookup.key] = { error: err.message || 'Query failed' };
      }

      // Respectful delay between requests
      if (i < lookups.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[fetch-rephonic-metrics] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
