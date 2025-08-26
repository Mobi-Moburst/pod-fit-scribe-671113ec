
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    if (obj?.published_at) return obj.published_at; // Listen Notes specific
    if (obj?.release_date) return obj.release_date; // Listen Notes specific
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
  
  // Try Listen Notes specific patterns
  const listenNotesPatterns = [
    /"published_at_ms":(\d+)/gi,
    /"published_at":"([^"]+)"/gi,
    /"release_date":"([^"]+)"/gi,
    /"pub_date_ms":(\d+)/gi,
    /"pub_date":"([^"]+)"/gi,
    /"latest_episode_pub_date_ms":(\d+)/gi,
    /"earliest_pub_date_ms":(\d+)/gi
  ];
  
  for (const pattern of listenNotesPatterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      const dates = matches.map(m => {
        const value = m[1];
        // If it's a timestamp in milliseconds, convert to ISO string
        if (/^\d+$/.test(value)) {
          return new Date(parseInt(value)).toISOString();
        }
        return value;
      }).filter(Boolean);
      const latest = findLatestDate(dates);
      if (latest) return latest;
    }
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

async function fetchWithRetry(url: string, maxRetries = 2): Promise<string> {
  const headers = [
    { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    { 'User-Agent': 'Mozilla/5.0 PodcastFitRaterBot' }
  ];

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, { 
        headers: headers[i] || headers[0],
        timeout: 15000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}:`, error);
      if (i === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Progressive delay
    }
  }
  throw new Error('All retry attempts failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    } });
  }
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ success: false, error: 'Missing url' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 });

    console.log(`Scraping URL: ${url}`);
    const html = await fetchWithRetry(url);

    const title = extractMeta(html, 'og:title', 'property') || extractMeta(html, 'twitter:title', 'name') || (html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '');
    const ogDesc = extractMeta(html, 'og:description', 'property') || extractMeta(html, 'twitter:description', 'name') || extractMeta(html, 'description', 'name');

    // JSON-LD descriptions with Listen Notes support
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

    // Enhanced Listen Notes specific extraction
    if (url.includes('listennotes.com') && !ldDesc) {
      // Try Listen Notes specific JSON patterns
      const listenNotesDescPatterns = [
        /"description":"([^"]+)"/gi,
        /"summary":"([^"]+)"/gi,
        /"notes":"([^"]+)"/gi
      ];
      
      for (const pattern of listenNotesDescPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          ldDesc = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
          break;
        }
      }
    }

    // Extract publish date
    const publishDate = extractPublishDate(html, jsonld);

    // Combine candidates
    const text = stripTags([ldDesc, ogDesc].filter(Boolean).join(' \n ')) || stripTags(html).slice(0, 20000);

    console.log(`Scraped ${url}: title="${title}", text_length=${text.length}, publish_date="${publishDate}"`);

    return new Response(JSON.stringify({ success: true, title, show_notes: text, publish_date: publishDate, length: text.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  } catch (e) {
    console.error(`Failed to scrape ${req.url}:`, e);
    const errorMessage = e instanceof Error ? e.message : 'Failed to fetch';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, status: 500 });
  }
});
