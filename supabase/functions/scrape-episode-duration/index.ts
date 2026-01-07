import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseDuration(duration: string | number): number | null {
  // Handle numeric seconds
  if (typeof duration === 'number') {
    return Math.round(duration / 60);
  }
  
  // Handle ISO 8601 format (PT1H30M45S or PT45M30S)
  const iso8601Match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (iso8601Match) {
    const hours = parseInt(iso8601Match[1] || '0');
    const minutes = parseInt(iso8601Match[2] || '0');
    const seconds = parseInt(iso8601Match[3] || '0');
    return Math.round(hours * 60 + minutes + seconds / 60);
  }
  
  // Handle HH:MM:SS or MM:SS
  const timeMatch = duration.match(/(\d+):(\d+)(?::(\d+))?/);
  if (timeMatch) {
    const part1 = parseInt(timeMatch[1]);
    const part2 = parseInt(timeMatch[2]);
    const part3 = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
    
    if (timeMatch[3]) {
      // HH:MM:SS
      return Math.round(part1 * 60 + part2 + part3 / 60);
    } else {
      // MM:SS
      return Math.round(part1 + part2 / 60);
    }
  }
  
  return null;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract Spotify episode ID from URL
function extractSpotifyEpisodeId(url: string): string | null {
  const match = url.match(/spotify\.com\/episode\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Fetch duration from YouTube Data API
async function getYouTubeDuration(videoId: string): Promise<number | null> {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) {
    console.log('YOUTUBE_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${apiKey}`
    );
    
    if (!response.ok) {
      console.log(`YouTube API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const duration = data.items[0].contentDetails?.duration;
      if (duration) {
        const minutes = parseDuration(duration);
        console.log(`Found YouTube duration: ${minutes} minutes`);
        return minutes;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching YouTube duration:', error);
    return null;
  }
}

// Fetch duration from Spotify oEmbed API
async function getSpotifyDuration(episodeId: string, originalUrl: string): Promise<number | null> {
  try {
    // Spotify oEmbed doesn't include duration, so we'll scrape the page
    const response = await fetch(originalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.log(`Spotify page fetch error: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Look for duration in meta tags
    const metaMatch = html.match(/meta\s+(?:property|name)=["']music:duration["']\s+content=["'](\d+)["']/i) ||
                      html.match(/meta\s+content=["'](\d+)["']\s+(?:property|name)=["']music:duration["']/i);
    
    if (metaMatch) {
      const seconds = parseInt(metaMatch[1]);
      const minutes = Math.round(seconds / 60);
      console.log(`Found Spotify duration from meta: ${minutes} minutes`);
      return minutes;
    }

    // Look for duration in JSON data within script tags
    const scriptMatch = html.match(/"duration_ms"\s*:\s*(\d+)/);
    if (scriptMatch) {
      const ms = parseInt(scriptMatch[1]);
      const minutes = Math.round(ms / 60000);
      console.log(`Found Spotify duration from JSON: ${minutes} minutes`);
      return minutes;
    }

    // Look for duration text pattern (e.g., "45 min", "1 hr 30 min")
    const durationTextMatch = html.match(/(\d+)\s*hr(?:s)?\s*(\d+)?\s*min/i) ||
                              html.match(/(\d+)\s*min/i);
    if (durationTextMatch) {
      if (durationTextMatch[2]) {
        // "X hr Y min" format
        const hours = parseInt(durationTextMatch[1]);
        const mins = parseInt(durationTextMatch[2]);
        const minutes = hours * 60 + mins;
        console.log(`Found Spotify duration from text: ${minutes} minutes`);
        return minutes;
      } else {
        // "X min" format
        const minutes = parseInt(durationTextMatch[1]);
        console.log(`Found Spotify duration from text: ${minutes} minutes`);
        return minutes;
      }
    }

    console.log('Could not find duration on Spotify page');
    return null;
  } catch (error) {
    console.error('Error fetching Spotify duration:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping episode duration from: ${url}`);

    // Check if it's a YouTube URL
    const youtubeId = extractYouTubeVideoId(url);
    if (youtubeId) {
      console.log(`Detected YouTube video: ${youtubeId}`);
      const duration = await getYouTubeDuration(youtubeId);
      if (duration !== null) {
        return new Response(
          JSON.stringify({ success: true, duration_minutes: duration, source: 'youtube' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if it's a Spotify URL
    const spotifyId = extractSpotifyEpisodeId(url);
    if (spotifyId) {
      console.log(`Detected Spotify episode: ${spotifyId}`);
      const duration = await getSpotifyDuration(spotifyId, url);
      if (duration !== null) {
        return new Response(
          JSON.stringify({ success: true, duration_minutes: duration, source: 'spotify' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Default: Fetch and parse the page (Apple Podcasts, etc.)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    let duration_minutes: number | null = null;

    // Strategy 1: Look for JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
          const data = JSON.parse(jsonContent);
          
          // Handle both single objects and arrays
          const items = Array.isArray(data) ? data : [data];
          
          for (const item of items) {
            if (item['@type'] === 'PodcastEpisode' && item.duration) {
              duration_minutes = parseDuration(item.duration);
              if (duration_minutes !== null) {
                console.log(`Found duration in JSON-LD: ${duration_minutes} minutes`);
                break;
              }
            }
          }
          
          if (duration_minutes !== null) break;
        } catch (e) {
          console.log('Error parsing JSON-LD:', e);
        }
      }
    }

    // Strategy 2: Look for meta tags with duration
    if (duration_minutes === null) {
      const metaPatterns = [
        /meta\s+(?:property|name)=["'](?:twitter:player:stream:duration|duration|video:duration)["']\s+content=["']([^"']+)["']/gi,
        /meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:twitter:player:stream:duration|duration|video:duration)["']/gi,
        /meta\s+itemprop=["']duration["']\s+content=["']([^"']+)["']/gi,
        /meta\s+content=["']([^"']+)["']\s+itemprop=["']duration["']/gi,
      ];

      for (const pattern of metaPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            duration_minutes = parseDuration(match[1]);
            if (duration_minutes !== null) {
              console.log(`Found duration in meta tags: ${duration_minutes} minutes`);
              break;
            }
          }
        }
        if (duration_minutes !== null) break;
      }
    }

    // Strategy 3: Look for duration in data attributes or visible text
    if (duration_minutes === null) {
      const dataPatterns = [
        /data-duration=["']([^"']+)["']/gi,
        /duration["\s:]+["']?(\d+:\d+(?::\d+)?)["']?/gi,
        /length["\s:]+["']?(\d+:\d+(?::\d+)?)["']?/gi,
      ];

      for (const pattern of dataPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            duration_minutes = parseDuration(match[1]);
            if (duration_minutes !== null) {
              console.log(`Found duration in data attributes: ${duration_minutes} minutes`);
              break;
            }
          }
        }
        if (duration_minutes !== null) break;
      }
    }

    if (duration_minutes === null) {
      console.log('Could not find duration in page');
      return new Response(
        JSON.stringify({ success: false, error: 'Duration not found on page' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, duration_minutes, source: 'page_scrape' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error scraping episode duration:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
