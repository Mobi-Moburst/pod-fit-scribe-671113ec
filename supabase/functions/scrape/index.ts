
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

    // Combine candidates
    const text = stripTags([ldDesc, ogDesc].filter(Boolean).join(' \n ')) || stripTags(html).slice(0, 20000);

    return new Response(JSON.stringify({ success: true, title, show_notes: text, length: text.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, status: 500 });
  }
});
