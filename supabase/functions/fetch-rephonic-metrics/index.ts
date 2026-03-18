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

function extractNameFromAppleUrl(url: string): string | null {
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

async function searchPodcast(query: string, apiKey: string): Promise<any[] | null> {
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
  const results = data?.podcasts || [];
  console.log(`[searchPodcast] Found ${results.length} results for "${query}"`);
  return results;
}

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
  const podcast = data?.podcast || data;
  console.log(`[getPodcastBySlug] name=${podcast.name}, downloads_per_episode=${podcast.downloads_per_episode}, social_reach=${podcast.social_reach}`);
  // Log all available fields to discover YouTube subscriber data
  const fieldKeys = Object.keys(podcast);
  console.log(`[getPodcastBySlug] Available fields: ${fieldKeys.join(', ')}`);
  // Log social/YouTube related fields specifically
  const socialFields = fieldKeys.filter(k => /youtube|social|subscriber|channel|facebook|twitter|instagram|linkedin|tiktok|x_|platform/i.test(k));
  console.log(`[getPodcastBySlug] Social-related fields: ${JSON.stringify(socialFields)}`);
  for (const key of socialFields) {
    console.log(`[getPodcastBySlug] ${key} = ${JSON.stringify(podcast[key])}`);
  }
  return podcast;
}

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

    const lookups: Array<{ key: string; name: string | null; appleId: string | null }> = [];

    if (apple_podcast_urls && Array.isArray(apple_podcast_urls)) {
      for (const url of apple_podcast_urls) {
        const appleId = extractAppleId(url);
        const name = extractNameFromAppleUrl(url) || (appleId ? await lookupApplePodcastName(appleId) : null);
        lookups.push({ key: url, name, appleId });
      }
    }

    if (podcast_names && Array.isArray(podcast_names)) {
      for (const name of podcast_names) {
        lookups.push({ key: name, name, appleId: null });
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

        const searchResults = await searchPodcast(searchName, apiKey);
        if (!searchResults || searchResults.length === 0) {
          results[lookup.key] = { error: 'Podcast not found on Rephonic' };
          continue;
        }

        let podcastData = searchResults[0];

        if (lookup.appleId) {
          const appleMatch = searchResults.find((candidate: any) =>
            String(candidate?.identifiers?.apple || candidate?.itunes_id || '') === String(lookup.appleId)
          );
          if (appleMatch) {
            podcastData = appleMatch;
          }
        }

        const slug = podcastData.id;
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
        const errorMessage = err instanceof Error ? err.message : 'Query failed';
        if (errorMessage === 'Rate limited') {
          console.warn('[fetch-rephonic-metrics] Rate limited, waiting 2s...');
          await new Promise(r => setTimeout(r, 2000));
          i--;
          continue;
        }
        console.error(`Error for ${lookup.key}:`, err);
        results[lookup.key] = { error: errorMessage };
      }

      if (i < lookups.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Internal error';
    console.error('[fetch-rephonic-metrics] Error:', err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});