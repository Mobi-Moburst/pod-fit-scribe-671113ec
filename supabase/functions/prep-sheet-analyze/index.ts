import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');

interface SocialMetrics {
  youtube?: { subscribers: number; url: string };
  instagram?: { followers: number; url: string };
  twitter?: { followers: number; url: string };
}

async function searchHostLinkedIn(hostName: string): Promise<string | null> {
  if (!googleApiKey) return null;
  
  try {
    const searchQuery = `"${hostName}" site:linkedin.com/in`;
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=017576662512468239146:omuauf_lfve&q=${encodeURIComponent(searchQuery)}&num=3`
    );
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      // Return the first LinkedIn profile found
      for (const item of data.items) {
        if (item.link.includes('linkedin.com/in/')) {
          return item.link;
        }
      }
    }
  } catch (error) {
    console.error('Error searching for LinkedIn:', error);
  }
  
  return null;
}

async function searchSocialMetrics(hostName: string, showTitle: string): Promise<SocialMetrics> {
  const metrics: SocialMetrics = {};
  
  try {
    // Search for YouTube channel
    if (youtubeApiKey) {
      const youtubeResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(hostName + ' ' + showTitle)}&type=channel&key=${youtubeApiKey}&maxResults=5`
      );
      
      const youtubeData = await youtubeResponse.json();
      
      if (youtubeData.items && youtubeData.items.length > 0) {
        const channelId = youtubeData.items[0].snippet.channelId;
        
        // Get channel statistics
        const statsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${youtubeApiKey}`
        );
        
        const statsData = await statsResponse.json();
        
        if (statsData.items && statsData.items.length > 0) {
          const subscriberCount = parseInt(statsData.items[0].statistics.subscriberCount);
          if (subscriberCount > 1000) {
            metrics.youtube = {
              subscribers: subscriberCount,
              url: `https://youtube.com/channel/${channelId}`
            };
          }
        }
      }
    }
    
    // Search for Instagram and Twitter using Google Custom Search
    if (googleApiKey) {
      // Instagram search
      const instagramResponse = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=017576662512468239146:omuauf_lfve&q=${encodeURIComponent(`"${hostName}" site:instagram.com`)}&num=3`
      );
      
      const instagramData = await instagramResponse.json();
      
      if (instagramData.items && instagramData.items.length > 0) {
        metrics.instagram = {
          followers: 0, // Would need Instagram Basic Display API for actual follower counts
          url: instagramData.items[0].link
        };
      }
      
      // Twitter search
      const twitterResponse = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=017576662512468239146:omuauf_lfve&q=${encodeURIComponent(`"${hostName}" site:twitter.com OR site:x.com`)}&num=3`
      );
      
      const twitterData = await twitterResponse.json();
      
      if (twitterData.items && twitterData.items.length > 0) {
        metrics.twitter = {
          followers: 0, // Would need Twitter API for actual follower counts
          url: twitterData.items[0].link
        };
      }
    }
  } catch (error) {
    console.error('Error searching for social metrics:', error);
  }
  
  return metrics;
}

async function analyzeWithOpenAI(scrapedData: any, client: any, hostLinkedIn?: string): Promise<any> {
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `
You are an expert interview preparation analyst. Based on the provided podcast episode data and client information, create a comprehensive prep sheet.

PODCAST DATA:
Title: ${scrapedData.title}
Show Notes: ${scrapedData.show_notes}
Publish Date: ${scrapedData.publish_date}

CLIENT INFORMATION:
Name: ${client.name}
Company: ${client.company}
Industry: ${client.industry}
Campaign Strategy: ${client.campaign_strategy}
Target Audiences: ${client.target_audiences?.join(', ')}
Topics to Prioritize: ${client.topics_to_prioritize?.join(', ')}
Topics to Avoid: ${client.topics_to_avoid?.join(', ')}
Content Goals: ${client.content_goals}
Call to Action: ${client.cta}

${hostLinkedIn ? `HOST LINKEDIN: ${hostLinkedIn}` : ''}

Please analyze and provide:

1. HOST INFORMATION:
   - Extract host name from the content
   - Determine host background and expertise areas
   - Identify host's interview style and typical questions

2. TAILORED TALKING POINTS:
   - Generate 5-7 specific talking points that align with:
     * The show's content themes and audience
     * The client's campaign goals and target messages
     * Topics that would resonate with this particular host
   - Make them specific to THIS show, not generic

3. AUDIENCE INSIGHTS:
   - Analyze the likely audience demographics and interests
   - Identify what topics and angles would most appeal to listeners
   - Note audience size indicators if mentioned

4. STRATEGIC RECOMMENDATIONS:
   - How the client should position themselves for this specific show
   - Key messages to emphasize based on show themes
   - Potential conversation bridges to the client's CTA

Respond in JSON format with:
{
  "hostName": "string",
  "hostBackground": "string (2-3 sentences)",
  "talkingPoints": ["array", "of", "5-7", "specific", "points"],
  "audienceInsights": "string (2-3 sentences)",
  "strategicRecommendations": "string (2-3 sentences)",
  "showThemes": ["array", "of", "main", "themes"],
  "estimatedAudienceSize": "string or null"
}

Make everything specific to this show and client combination, not generic advice.
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert interview preparation analyst. Provide detailed, actionable insights in valid JSON format.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error with OpenAI analysis:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, client, recordingDateTime, manualLinkedIn } = await req.json();

    console.log('Processing prep sheet request for:', url);

    // First, scrape the podcast URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: scrapedData, error: scrapeError } = await supabase.functions.invoke('scrape', {
      body: { url }
    });

    if (scrapeError) {
      throw new Error(`Failed to scrape URL: ${scrapeError.message}`);
    }

    console.log('Scraped data:', scrapedData);

    // Extract host name from scraped content for LinkedIn search
    let hostLinkedIn = manualLinkedIn;
    let needsManualLinkedIn = false;

    if (!hostLinkedIn) {
      // Try to extract host name from content and search for LinkedIn
      const hostNameMatch = scrapedData.show_notes?.match(/host[ed by]*:?\s*([A-Za-z\s]+)/i) ||
                           scrapedData.title?.match(/with\s+([A-Za-z\s]+)/i);
      
      if (hostNameMatch) {
        const extractedHostName = hostNameMatch[1].trim();
        console.log('Extracted host name:', extractedHostName);
        
        hostLinkedIn = await searchHostLinkedIn(extractedHostName);
        
        if (!hostLinkedIn) {
          needsManualLinkedIn = true;
          console.log('LinkedIn search failed, will need manual input');
        }
      } else {
        needsManualLinkedIn = true;
        console.log('Could not extract host name, will need manual input');
      }
    }

    // If we still don't have LinkedIn and this is the first attempt, return early with flag
    if (!hostLinkedIn && !manualLinkedIn && needsManualLinkedIn) {
      return new Response(JSON.stringify({
        needsManualLinkedIn: true,
        showTitle: scrapedData.title,
        hostName: 'Unknown Host'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Analyze with OpenAI
    const analysis = await analyzeWithOpenAI(scrapedData, client, hostLinkedIn);

    // Search for social media metrics
    const socialMetrics = await searchSocialMetrics(analysis.hostName, scrapedData.title);

    // Compile notable metrics
    let metrics = '';
    if (socialMetrics.youtube && socialMetrics.youtube.subscribers > 1000) {
      metrics += `YouTube: ${socialMetrics.youtube.subscribers.toLocaleString()} subscribers. `;
    }
    if (socialMetrics.instagram) {
      metrics += `Instagram: Active presence. `;
    }
    if (socialMetrics.twitter) {
      metrics += `Twitter/X: Active presence. `;
    }
    if (analysis.estimatedAudienceSize) {
      metrics += `Estimated audience: ${analysis.estimatedAudienceSize}. `;
    }

    const result = {
      showTitle: scrapedData.title,
      hostName: analysis.hostName,
      hostLinkedIn: hostLinkedIn,
      hostBackground: analysis.hostBackground,
      talkingPoints: analysis.talkingPoints,
      audienceInsights: analysis.audienceInsights,
      strategicRecommendations: analysis.strategicRecommendations,
      metrics: metrics.trim() || 'No significant metrics found.',
      socialMetrics: socialMetrics,
      recordingDateTime: recordingDateTime,
      needsManualLinkedIn: false
    };

    console.log('Prep sheet analysis complete');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in prep sheet analysis:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});