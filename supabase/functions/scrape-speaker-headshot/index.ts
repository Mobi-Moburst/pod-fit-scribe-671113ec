const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping headshot from:', formattedUrl);

    // Use Firecrawl's screenshot + links to find headshot
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['links', 'markdown'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Failed to scrape page' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const links = data.data?.links || data.links || [];
    const markdown = data.data?.markdown || data.markdown || '';

    // Extract image URLs from markdown (![alt](url) patterns)
    const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imageUrls: { url: string; alt: string }[] = [];
    let match;
    while ((match = mdImageRegex.exec(markdown)) !== null) {
      imageUrls.push({ alt: match[1], url: match[2] });
    }

    // Also check links for image URLs
    const imageExtensions = /\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i;
    const linkImages = (links as string[]).filter((l: string) => imageExtensions.test(l));

    // Score images to find the most likely headshot
    const headshotKeywords = /headshot|portrait|profile|photo|speaker|author|founder|ceo|head-shot|team|about/i;
    const avoidKeywords = /logo|icon|favicon|banner|hero|bg|background|pattern|badge|award|certificate|button|arrow|social|twitter|facebook|linkedin|instagram|youtube|podcast|apple|spotify|play/i;

    type Candidate = { url: string; score: number };
    const candidates: Candidate[] = [];

    for (const img of imageUrls) {
      const combined = `${img.alt} ${img.url}`;
      if (avoidKeywords.test(combined)) continue;
      let score = 0;
      if (headshotKeywords.test(combined)) score += 3;
      if (imageExtensions.test(img.url)) score += 1;
      // Prefer larger-sounding images
      if (/\d{3,4}x\d{3,4}/.test(img.url) || /large|full|original|high/i.test(img.url)) score += 1;
      // Alt text mentioning a person's name (contains space = likely a name)
      if (img.alt && img.alt.includes(' ') && !avoidKeywords.test(img.alt)) score += 2;
      candidates.push({ url: img.url, score });
    }

    for (const linkUrl of linkImages) {
      if (avoidKeywords.test(linkUrl)) continue;
      if (candidates.some(c => c.url === linkUrl)) continue;
      let score = 0;
      if (headshotKeywords.test(linkUrl)) score += 3;
      candidates.push({ url: linkUrl, score });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const bestMatch = candidates[0];

    if (!bestMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'No headshot image found on this page' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Best headshot candidate:', bestMatch.url, 'score:', bestMatch.score);

    return new Response(
      JSON.stringify({
        success: true,
        headshot_url: bestMatch.url,
        candidates: candidates.slice(0, 5).map(c => c.url),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
