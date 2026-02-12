import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PODCHASER_API_URL = 'https://api.podchaser.com/graphql';

// Extract Apple Podcast ID from URL
function extractAppleId(url: string): string | null {
  // Match patterns like /id1234567890 or id1234567890
  const match = url.match(/\/id(\d+)/i);
  return match ? match[1] : null;
}

// Get Podchaser access token using client credentials
async function getAccessToken(): Promise<string> {
  const apiKey = Deno.env.get('PODCHASER_API_KEY');
  const apiSecret = Deno.env.get('PODCHASER_API_SECRET');
  
  if (!apiKey || !apiSecret) {
    throw new Error('PODCHASER_API_KEY or PODCHASER_API_SECRET not configured');
  }
  
  const response = await fetch(PODCHASER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation { requestAccessToken(input: { client_id: "${apiKey}", client_secret: "${apiSecret}", grant_type: CLIENT_CREDENTIALS }) { access_token token_type expires_in } }`,
    }),
  });
  
  const result = await response.json();
  
  if (result.errors) {
    console.error('Podchaser auth error:', JSON.stringify(result.errors));
    throw new Error(`Podchaser auth failed: ${result.errors[0]?.message || 'Unknown error'}`);
  }
  
  const token = result.data?.requestAccessToken?.access_token;
  if (!token) {
    throw new Error('No access token returned from Podchaser');
  }
  
  return token;
}

// Query Podchaser for a single podcast by Apple ID
// Try full query first, fall back to basic fields if auth errors
async function queryPodcast(appleId: string, token: string): Promise<any> {
  // Full query with all fields (some may require higher plan)
  const fullQuery = `
    query GetPodcast($id: String!) {
      podcast(identifier: { id: $id, type: APPLE_PODCASTS }) {
        title
        description
        audienceEstimate
        categories { title }
        socialFollowerCounts {
          youtube
          twitter
          instagram
          linkedin
          tiktok
          facebook
        }
      }
    }
  `;
  
  const response = await fetch(PODCHASER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: fullQuery,
      variables: { id: appleId },
    }),
  });
  
  const result = await response.json();
  
  // GraphQL can return both data and errors (partial success)
  if (result.data?.podcast) {
    if (result.errors) {
      console.warn(`Podchaser partial errors for Apple ID ${appleId} (data still returned):`, 
        result.errors.map((e: any) => e.message).join('; '));
    }
    return result.data.podcast;
  }
  
  // If no data at all, try basic query without restricted fields
  if (result.errors) {
    console.warn(`Podchaser full query failed for Apple ID ${appleId}, trying basic query`);
    
    const basicQuery = `
      query GetPodcast($id: String!) {
        podcast(identifier: { id: $id, type: APPLE_PODCASTS }) {
          title
          description
          categories { title }
        }
      }
    `;
    
    const basicResponse = await fetch(PODCHASER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: basicQuery,
        variables: { id: appleId },
      }),
    });
    
    const basicResult = await basicResponse.json();
    if (basicResult.data?.podcast) {
      return basicResult.data.podcast;
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { apple_podcast_urls } = await req.json();
    
    if (!apple_podcast_urls || !Array.isArray(apple_podcast_urls) || apple_podcast_urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'apple_podcast_urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Fetching Podchaser metrics for ${apple_podcast_urls.length} podcasts`);
    
    // Get access token
    const token = await getAccessToken();
    console.log('Podchaser auth successful');
    
    // Process each URL
    const results: Record<string, any> = {};
    
    for (const url of apple_podcast_urls) {
      const appleId = extractAppleId(url);
      if (!appleId) {
        console.warn(`Could not extract Apple ID from URL: ${url}`);
        results[url] = { error: 'Invalid Apple Podcast URL' };
        continue;
      }
      
      try {
        const podcast = await queryPodcast(appleId, token);
        
        if (podcast) {
          const categories = podcast.categories
            ?.map((c: any) => c.title)
            .filter(Boolean)
            .join(', ') || '';
          
          // Sum all social platform followers
          const social = podcast.socialFollowerCounts || {};
          const totalSocial = (social.youtube || 0) + (social.twitter || 0) + 
            (social.instagram || 0) + (social.linkedin || 0) + 
            (social.tiktok || 0) + (social.facebook || 0);
          
          results[url] = {
            podcast_name: podcast.title || '',
            listeners_per_episode: podcast.audienceEstimate || 0,
            monthly_listens: podcast.audienceEstimate || 0,
            social_reach: totalSocial,
            categories,
            description: podcast.description || '',
          };
          
          console.log(`Found metrics for "${podcast.title}": listeners=${podcast.audienceEstimate}, social=${totalSocial}`);
        } else {
          results[url] = { error: 'Podcast not found on Podchaser' };
        }
      } catch (err) {
        console.error(`Error querying podcast ${url}:`, err);
        results[url] = { error: err.message || 'Query failed' };
      }
      
      // Small delay between queries to be nice to the API
      if (apple_podcast_urls.indexOf(url) < apple_podcast_urls.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err) {
    console.error('fetch-podchaser-metrics error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
