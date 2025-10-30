import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(content: string, name: string, attr: 'name'|'property' = 'name') {
  const re = new RegExp(`<meta[^>]+${attr}=[\"']${name}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>`, 'i');
  const m = content.match(re);
  return m?.[1] || '';
}

function extractJSONLD(content: string): any[] {
  const scripts = [...content.matchAll(/<script[^>]+type=["']application\/(ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[2]);
  const out: any[] = [];
  for (const s of scripts) {
    try { const json = JSON.parse(s); out.push(json); } catch {}
  }
  return out.flat();
}

function extractPublishDate(content: string, jsonld: any[]): string | undefined {
  // Helper to extract date from object
  const checkDate = (obj: any): string | undefined => {
    if (obj?.datePublished) return obj.datePublished;
    if (obj?.publishDate) return obj.publishDate;
    if (obj?.pubDate) return obj.pubDate;
    return undefined;
  };

  // Helper to find most recent date from array
  const findLatestDate = (dates: string[]): string | undefined => {
    if (dates.length === 0) return undefined;
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  };

  // Try JSON-LD first - Enhanced for show pages
  const foundDates: string[] = [];
  
  for (const j of jsonld) {
    const jType = j?.['@type'];
    
    // Handle PodcastSeries with episode collections
    if (jType === 'PodcastSeries' && j?.episode) {
      const episodes = Array.isArray(j.episode) ? j.episode : [j.episode];
      for (const ep of episodes) {
        const date = checkDate(ep);
        if (date) foundDates.push(date);
      }
    }
    
    // Handle individual episodes or direct dates
    const date = checkDate(j);
    if (date) foundDates.push(date);
    
    // Check if it's an array of episodes
    if (Array.isArray(j)) {
      for (const item of j) {
        const itemDate = checkDate(item);
        if (itemDate) foundDates.push(itemDate);
        
        // Check nested episode arrays
        if (item?.episode) {
          const episodes = Array.isArray(item.episode) ? item.episode : [item.episode];
          for (const ep of episodes) {
            const epDate = checkDate(ep);
            if (epDate) foundDates.push(epDate);
          }
        }
      }
    }
    
    // Handle nested episode data structures
    if (j?.hasEpisode || j?.episodes) {
      const episodes = j.hasEpisode || j.episodes;
      const episodeArray = Array.isArray(episodes) ? episodes : [episodes];
      for (const ep of episodeArray) {
        const date = checkDate(ep);
        if (date) foundDates.push(date);
      }
    }
  }
  
  // Return most recent date from JSON-LD if found
  if (foundDates.length > 0) {
    return findLatestDate(foundDates);
  }
  
  // Try Apple Podcasts specific patterns
  const applePodcastsPatterns = [
    /<time[^>]+datetime="([^"]+)"/gi,
    /"datePublished":"([^"]+)"/gi,
    /"releaseDate":"([^"]+)"/gi
  ];
  
  for (const pattern of applePodcastsPatterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      const dates = matches.map(m => m[1]).filter(Boolean);
      const latest = findLatestDate(dates);
      if (latest) return latest;
    }
  }
  
  // Try Spotify specific patterns
  const spotifyPatterns = [
    /"publishedAt":"([^"]+)"/gi,
    /"releaseDate":\s*"([^"]+)"/gi,
    /"date":"([^"]+)"/gi
  ];
  
  for (const pattern of spotifyPatterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      const dates = matches.map(m => m[1]).filter(Boolean);
      const latest = findLatestDate(dates);
      if (latest) return latest;
    }
  }
  
  // Try meta tags (medium priority)
  const metaPatterns = [
    'article:published_time',
    'pubdate',
    'DC.date',
    'date'
  ];
  
  for (const pattern of metaPatterns) {
    const date = extractMeta(content, pattern, 'property') || extractMeta(content, pattern, 'name');
    if (date) foundDates.push(date);
  }
  
  // Try RSS pubDate in content
  const rssMatch = content.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);
  if (rssMatch) foundDates.push(rssMatch[1]);
  
  // Try lastBuildDate
  const buildMatch = content.match(/<lastBuildDate[^>]*>([^<]+)<\/lastBuildDate>/i);
  if (buildMatch) foundDates.push(buildMatch[1]);
  
  // Fallback: Look for recent date patterns in content
  const datePatterns = [
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+202[3-9]\b/gi,
    /\b202[3-9]-\d{2}-\d{2}\b/g,
    /\b\d{1,2}\/\d{1,2}\/202[3-9]\b/g
  ];
  
  for (const pattern of datePatterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      const dates = matches.map(m => m[0]).filter(Boolean);
      const latest = findLatestDate(dates);
      if (latest) foundDates.push(latest);
    }
  }
  
  return foundDates.length > 0 ? findLatestDate(foundDates) : undefined;
}

// Validation schema
const RequestSchema = z.object({
  url: z.string()
    .url({ message: 'Invalid URL format' })
    .max(2048, { message: 'URL must be less than 2048 characters' })
    .refine(url => {
      try {
        const parsed = new URL(url);
        // Block local/private IPs to prevent SSRF
        const hostname = parsed.hostname;
        if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.') || 
            hostname.startsWith('10.') || hostname.startsWith('172.')) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }, { message: 'URL must not point to local/private networks' })
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify JWT authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('Missing or invalid Authorization header');
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create Supabase client with user's JWT
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // Verify the JWT token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('Authentication failed:', authError?.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid authentication token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Authenticated user:', user.id);

  try {
    // Parse and validate request
    const body = await req.json();
    const validation = RequestSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('Validation error:', validation.error.issues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request', 
          details: validation.error.issues.map(i => i.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = validation.data;

    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 PodcastFitRaterBot' } });
    const html = await r.text();

    const title = extractMeta(html, 'og:title', 'property') || extractMeta(html, 'twitter:title', 'name') || (html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '');
    const ogDesc = extractMeta(html, 'og:description', 'property') || extractMeta(html, 'twitter:description', 'name') || extractMeta(html, 'description', 'name');

    // JSON-LD descriptions
    const jsonld = extractJSONLD(html);
    let ldDesc = '';
    for (const j of jsonld) {
      if ((j as any)?.description) {
        ldDesc = (j as any).description;
        break;
      }
      if (Array.isArray(j)) {
        const f = (j as any[]).find((x: any) => x?.description);
        if (f) {
          ldDesc = f.description;
          break;
        }
      }
      // FIX: use bracket notation for "@type"
      const jType = (j as any)?.['@type'];
      if (jType && (jType === 'PodcastEpisode' || jType === 'PodcastSeries') && (j as any)?.description) {
        ldDesc = (j as any).description;
        break;
      }
    }

    // Extract publish date
    const publishDate = extractPublishDate(html, jsonld);

    // Combine candidates
    const text = stripTags([ldDesc, ogDesc].filter(Boolean).join(' \n ')) || stripTags(html).slice(0, 20000);

    console.log(`Successfully scraped: ${url.substring(0, 50)}... (${text.length} chars)`);

    return new Response(
      JSON.stringify({ success: true, title, show_notes: text, publish_date: publishDate, length: text.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in scrape function:', e);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch URL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
