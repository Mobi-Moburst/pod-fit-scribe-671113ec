import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedEpisode {
  title: string;
  podcast_name: string;
  publisher: string;
  publish_date: string;
  episode_url: string;
  apple_podcast_url?: string;
  listeners?: number;
  categories?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitorName, startDate, endDate } = await req.json();
    
    console.log('[scrape-rephonic-sov] Starting scrape for:', competitorName);
    console.log('[scrape-rephonic-sov] Date range:', startDate, 'to', endDate);

    if (!competitorName) {
      throw new Error('competitorName is required');
    }

    // Get auth cookie from secrets
    const authCookie = Deno.env.get('REPHONIC_AUTH_COOKIE');
    console.log('[scrape-rephonic-sov] Auth cookie available:', !!authCookie);

    // Build Rephonic search URL
    const searchUrl = `https://rephonic.com/search/episodes/%22${encodeURIComponent(competitorName)}%22?filters=sort:eq:newest`;
    console.log('[scrape-rephonic-sov] Search URL:', searchUrl);

    // Fetch with or without auth cookie
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    if (authCookie) {
      headers['Cookie'] = authCookie;
    }

    const response = await fetch(searchUrl, { headers });
    
    if (!response.ok) {
      console.error('[scrape-rephonic-sov] Fetch failed:', response.status, response.statusText);
      throw new Error(`Failed to fetch Rephonic: ${response.status}`);
    }

    const html = await response.text();
    console.log('[scrape-rephonic-sov] HTML length:', html.length);

    // Extract __NEXT_DATA__ JSON from the page
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    
    if (!nextDataMatch) {
      console.error('[scrape-rephonic-sov] __NEXT_DATA__ not found in HTML');
      throw new Error('Could not find episode data in page');
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    console.log('[scrape-rephonic-sov] Parsed __NEXT_DATA__');

    // Navigate the data structure to find episodes
    const episodesData = nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.episodes || [];
    console.log('[scrape-rephonic-sov] Found episodes:', episodesData.length);

    // Parse date range for filtering
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    // Transform and filter episodes
    const episodes: ScrapedEpisode[] = episodesData
      .map((ep: any) => {
        const publishDate = new Date(ep.date_published);
        
        return {
          title: ep.title || 'Untitled',
          podcast_name: ep.podcast?.title || 'Unknown Podcast',
          publisher: ep.podcast?.publisher || 'Unknown',
          publish_date: ep.date_published,
          episode_url: ep.link || '',
          apple_podcast_url: ep.podcast?.apple_url || undefined,
          listeners: ep.podcast?.listeners_per_episode || undefined,
          categories: ep.podcast?.categories?.map((c: any) => c.name) || [],
        };
      })
      .filter((ep: ScrapedEpisode) => {
        // Filter by date range if provided
        if (start || end) {
          const epDate = new Date(ep.publish_date);
          if (start && epDate < start) return false;
          if (end && epDate > end) return false;
        }
        return true;
      });

    console.log('[scrape-rephonic-sov] Filtered episodes:', episodes.length);

    // Check if results are limited (typically 6 without auth)
    const isLimited = episodesData.length === 6 && !authCookie;

    return new Response(
      JSON.stringify({
        success: true,
        competitor_name: competitorName,
        episode_count: episodes.length,
        episodes: episodes,
        is_limited: isLimited,
        total_found: episodesData.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[scrape-rephonic-sov] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        episode_count: 0,
        episodes: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
