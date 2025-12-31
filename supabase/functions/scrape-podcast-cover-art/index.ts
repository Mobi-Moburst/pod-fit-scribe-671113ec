import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apple_podcast_url } = await req.json();

    if (!apple_podcast_url) {
      console.log('No Apple Podcast URL provided');
      return new Response(JSON.stringify({ error: 'No Apple Podcast URL provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching cover art for:', apple_podcast_url);

    // Extract podcast ID from URL (e.g., /id1234567890)
    const idMatch = apple_podcast_url.match(/\/id(\d+)/);
    if (!idMatch) {
      console.log('Could not extract podcast ID from URL:', apple_podcast_url);
      return new Response(JSON.stringify({ error: 'Invalid Apple Podcast URL format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const podcastId = idMatch[1];
    console.log('Extracted podcast ID:', podcastId);

    // Call iTunes Lookup API
    const itunesResponse = await fetch(`https://itunes.apple.com/lookup?id=${podcastId}`);
    if (!itunesResponse.ok) {
      console.error('iTunes API error:', itunesResponse.status);
      return new Response(JSON.stringify({ error: 'iTunes API request failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const itunesData = await itunesResponse.json();
    console.log('iTunes API response resultCount:', itunesData.resultCount);

    if (!itunesData.results || itunesData.results.length === 0) {
      console.log('No results from iTunes API for podcast ID:', podcastId);
      return new Response(JSON.stringify({ error: 'Podcast not found in iTunes' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const podcast = itunesData.results[0];
    const coverArtUrl = podcast.artworkUrl600 || podcast.artworkUrl100 || null;
    const primaryGenreName = podcast.primaryGenreName || null;
    const genres = podcast.genres || [];

    console.log('Found cover art URL:', coverArtUrl);
    console.log('Found genres:', genres);

    return new Response(JSON.stringify({ 
      coverArtUrl,
      podcastName: podcast.collectionName,
      artistName: podcast.artistName,
      primaryGenreName,
      genres,
      description: podcast.description || podcast.shortDescription || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scrape-podcast-cover-art:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
