import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversionResult {
  success: boolean;
  original_url: string;
  apple_podcast_url?: string;
  error?: string;
  podcast_title?: string;
}

// Extract podcast ID from ListenNotes URL
function extractListenNotesId(url: string): string | null {
  const patterns = [
    /listennotes\.com\/podcasts\/[^\/]+\/([a-zA-Z0-9]+)/,
    /listennotes\.com\/podcasts\/([a-zA-Z0-9]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get podcast info from ListenNotes
async function getPodcastFromListenNotes(podcastId: string): Promise<{title: string, publisher?: string} | null> {
  try {
    // Try to fetch the ListenNotes page and extract title
    const response = await fetch(`https://www.listennotes.com/podcasts/${podcastId}/`);
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract title from meta tags or page title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) ||
                      html.match(/<title>([^<]+)</title>/i);
    
    if (titleMatch) {
      let title = titleMatch[1].trim();
      // Clean up common suffixes
      title = title.replace(/\s*\|\s*Listen Notes.*$/i, '');
      title = title.replace(/\s*-\s*Podcast.*$/i, '');
      return { title };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from ListenNotes:', error);
    return null;
  }
}

// Search for podcast on Apple Podcasts
async function searchApplePodcasts(title: string): Promise<string | null> {
  try {
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=podcast&limit=5`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Return the first result's collection view URL
      const podcast = data.results[0];
      if (podcast.collectionViewUrl) {
        return podcast.collectionViewUrl;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Apple Podcasts:', error);
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
      return new Response(JSON.stringify({
        success: false,
        original_url: url,
        error: 'URL is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if it's already an Apple Podcast URL
    if (url.includes('podcasts.apple.com')) {
      return new Response(JSON.stringify({
        success: true,
        original_url: url,
        apple_podcast_url: url,
        podcast_title: 'Already Apple Podcast URL'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if it's a ListenNotes URL
    if (!url.includes('listennotes.com')) {
      return new Response(JSON.stringify({
        success: false,
        original_url: url,
        error: 'Only ListenNotes URLs are supported for conversion'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Converting ListenNotes URL:', url);

    // Extract podcast ID from ListenNotes URL
    const podcastId = extractListenNotesId(url);
    if (!podcastId) {
      return new Response(JSON.stringify({
        success: false,
        original_url: url,
        error: 'Could not extract podcast ID from ListenNotes URL'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Extracted podcast ID:', podcastId);

    // Get podcast info from ListenNotes
    const podcastInfo = await getPodcastFromListenNotes(podcastId);
    if (!podcastInfo) {
      return new Response(JSON.stringify({
        success: false,
        original_url: url,
        error: 'Could not fetch podcast information from ListenNotes'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found podcast:', podcastInfo.title);

    // Search for the podcast on Apple Podcasts
    const applePodcastUrl = await searchApplePodcasts(podcastInfo.title);
    
    if (!applePodcastUrl) {
      return new Response(JSON.stringify({
        success: false,
        original_url: url,
        error: `Could not find "${podcastInfo.title}" on Apple Podcasts`,
        podcast_title: podcastInfo.title
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found Apple Podcast URL:', applePodcastUrl);

    return new Response(JSON.stringify({
      success: true,
      original_url: url,
      apple_podcast_url: applePodcastUrl,
      podcast_title: podcastInfo.title
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in convert-podcast-url function:', error);
    return new Response(JSON.stringify({
      success: false,
      original_url: '',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});