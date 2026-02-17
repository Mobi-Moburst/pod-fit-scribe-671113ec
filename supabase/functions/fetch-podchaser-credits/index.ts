import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PODCHASER_API_URL = 'https://api.podchaser.com/graphql';

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

async function searchCredits(name: string, token: string): Promise<any> {
  const query = `
    query SearchCredits($name: String!) {
      credits(
        searchTerm: $name
        first: 100
      ) {
        paginatorInfo { total }
        data {
          podcast { title }
          creator { name }
          role { title }
          episodeCount
          episodeCredits(first: 100) {
            data {
              episode {
                title
                airDate
              }
            }
          }
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
      query,
      variables: { name },
    }),
  });

  const result = await response.json();

  if (result.errors) {
    const errorMsg = result.errors[0]?.message || 'Unknown error';
    console.error(`Podchaser credits error for "${name}":`, errorMsg);
    throw new Error(errorMsg);
  }

  return result.data?.credits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitors, date_range } = await req.json();

    if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
      return new Response(
        JSON.stringify({ error: 'competitors array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!date_range?.start || !date_range?.end) {
      return new Response(
        JSON.stringify({ error: 'date_range with start and end is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rangeStart = new Date(date_range.start);
    const rangeEnd = new Date(date_range.end);
    
    console.log(`Fetching Podchaser credits for ${competitors.length} competitors, range: ${date_range.start} to ${date_range.end}`);

    const token = await getAccessToken();
    console.log('Podchaser auth successful');

    const results: Record<string, { interview_count: number; episodes: any[]; error?: string }> = {};

    for (const competitor of competitors) {
      const name = competitor.name;
      try {
        const credits = await searchCredits(name, token);

        if (!credits || !credits.data) {
          results[name] = { interview_count: 0, episodes: [], error: 'No results found' };
          continue;
        }

        // Flatten all episode credits from all podcast credits, filter by date range
        const filteredEpisodes: any[] = [];
        for (const credit of credits.data) {
          const podcastTitle = credit.podcast?.title || '';
          const roleTitle = credit.role?.title || '';
          const episodeCreditsData = credit.episodeCredits?.data || [];
          
          for (const ec of episodeCreditsData) {
            if (!ec.episode?.airDate) continue;
            const airDate = new Date(ec.episode.airDate);
            if (airDate >= rangeStart && airDate <= rangeEnd) {
              filteredEpisodes.push({
                title: ec.episode?.title || '',
                podcast_name: podcastTitle,
                air_date: ec.episode.airDate,
                role: roleTitle,
              });
            }
          }
        }

        results[name] = {
          interview_count: filteredEpisodes.length,
          episodes: filteredEpisodes,
        };

        console.log(`"${name}": ${filteredEpisodes.length} episodes in range (${credits.paginatorInfo?.total || 0} total credits)`);
      } catch (err) {
        console.error(`Error fetching credits for "${name}":`, err);
        results[name] = { interview_count: 0, episodes: [], error: err.message || 'Query failed' };
      }

      // Small delay between queries
      if (competitors.indexOf(competitor) < competitors.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('fetch-podchaser-credits error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
