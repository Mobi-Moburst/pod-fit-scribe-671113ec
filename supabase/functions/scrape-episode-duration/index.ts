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

    // Fetch the page content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PodcastBot/1.0)',
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
      JSON.stringify({ success: true, duration_minutes }),
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
