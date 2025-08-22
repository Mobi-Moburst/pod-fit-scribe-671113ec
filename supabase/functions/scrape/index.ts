
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
  // Try JSON-LD first (highest priority)
  for (const j of jsonld) {
    const checkDate = (obj: any): string | undefined => {
      if (obj?.datePublished) return obj.datePublished;
      if (obj?.publishDate) return obj.publishDate;
      if (obj?.pubDate) return obj.pubDate;
      return undefined;
    };
    
    const date = checkDate(j);
    if (date) return date;
    
    // Check if it's an array
    if (Array.isArray(j)) {
      for (const item of j) {
        const date = checkDate(item);
        if (date) return date;
      }
    }
    
    // Check for podcast-specific types
    const jType = j?.['@type'];
    if (jType && (jType === 'PodcastEpisode' || jType === 'PodcastSeries')) {
      const date = checkDate(j);
      if (date) return date;
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
    if (date) return date;
  }
  
  // Try RSS pubDate in content (lower priority)
  const rssMatch = content.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);
  if (rssMatch) return rssMatch[1];
  
  // Try lastBuildDate
  const buildMatch = content.match(/<lastBuildDate[^>]*>([^<]+)<\/lastBuildDate>/i);
  if (buildMatch) return buildMatch[1];
  
  return undefined;
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

    return new Response(JSON.stringify({ success: true, title, show_notes: text, publish_date: publishDate, length: text.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, status: 500 });
  }
});
