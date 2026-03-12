const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EpisodeMetadata {
  url: string;
  podcast_name: string;
  episode_title: string;
  air_date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cap at 20 URLs to prevent excessive credit usage
    const urlsToScrape = urls.slice(0, 20).filter((u: string) => u && u.trim());
    console.log(`Scraping metadata for ${urlsToScrape.length} episode URLs`);

    const results: EpisodeMetadata[] = [];

    // Process sequentially to be kind to the API
    for (const url of urlsToScrape) {
      try {
        let formattedUrl = url.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = `https://${formattedUrl}`;
        }

        console.log('Scraping:', formattedUrl);

        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        if (!response.ok) {
          console.error(`Failed to scrape ${formattedUrl}: ${response.status}`);
          results.push({ url, podcast_name: '', episode_title: '', air_date: '' });
          continue;
        }

        const data = await response.json();
        const metadata = data.data?.metadata || data.metadata || {};
        const markdown = data.data?.markdown || data.markdown || '';

        // Extract from og/meta tags first
        let podcastName = '';
        let episodeTitle = '';
        let airDate = '';

        const pageTitle = metadata.title || '';
        const ogTitle = metadata.ogTitle || metadata['og:title'] || '';
        const description = metadata.description || metadata.ogDescription || '';

        // Try to parse podcast name and episode title from page title
        // Common patterns: "Episode Title | Podcast Name", "Episode Title - Podcast Name"
        const titleSource = ogTitle || pageTitle;
        
        if (titleSource) {
          // Try splitting by common separators
          const separators = [' | ', ' - ', ' — ', ' – ', ' · '];
          let parsed = false;
          
          for (const sep of separators) {
            if (titleSource.includes(sep)) {
              const parts = titleSource.split(sep);
              if (parts.length >= 2) {
                // For Apple Podcasts: "Episode Title - Podcast Name"
                // For Spotify: "Episode Title | Spotify"
                // For YouTube: "Episode Title - YouTube"
                const lastPart = parts[parts.length - 1].trim();
                const isGenericPlatform = ['spotify', 'youtube', 'apple podcasts', 'podchaser', 'listen notes'].some(
                  p => lastPart.toLowerCase().includes(p)
                );
                
                if (isGenericPlatform && parts.length > 2) {
                  episodeTitle = parts[0].trim();
                  podcastName = parts[1].trim();
                } else if (isGenericPlatform) {
                  episodeTitle = parts[0].trim();
                } else {
                  episodeTitle = parts.slice(0, -1).join(sep).trim();
                  podcastName = lastPart;
                }
                parsed = true;
                break;
              }
            }
          }
          
          if (!parsed) {
            episodeTitle = titleSource;
          }
        }

        // Try to extract podcast name from og:site_name or other metadata
        if (!podcastName) {
          podcastName = metadata.ogSiteName || metadata['og:site_name'] || '';
          // Skip generic platform names
          if (['Spotify', 'YouTube', 'Apple Podcasts', 'Podchaser', 'Listen Notes'].includes(podcastName)) {
            podcastName = '';
          }
        }

        // Try to extract air date from metadata
        airDate = metadata.ogArticlePublishedTime || 
                  metadata['article:published_time'] || 
                  metadata.datePublished ||
                  metadata.publishDate || '';

        // If still no podcast name, try extracting from markdown (first heading or bold text)
        if (!podcastName && markdown) {
          const headingMatch = markdown.match(/^#\s+(.+)/m);
          if (headingMatch && headingMatch[1] !== episodeTitle) {
            podcastName = headingMatch[1].trim();
          }
        }

        console.log(`Extracted - Podcast: "${podcastName}", Episode: "${episodeTitle}", Date: "${airDate}"`);
        
        results.push({
          url,
          podcast_name: podcastName,
          episode_title: episodeTitle,
          air_date: airDate,
        });

      } catch (err) {
        console.error(`Error scraping ${url}:`, err);
        results.push({ url, podcast_name: '', episode_title: '', air_date: '' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, episodes: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-episode-metadata:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
