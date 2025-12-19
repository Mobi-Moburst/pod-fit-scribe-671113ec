import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TargetPodcastSuggestion {
  podcast_name: string;
  description: string;
  pitch_angle: string;
  talking_points: string[];
  target_audience: string;
  apple_podcast_url?: string;
}

interface RequestBody {
  client: {
    name: string;
    company: string;
    title?: string;
    talking_points?: string[];
    target_audiences?: string[];
    campaign_strategy?: string;
  };
  next_quarter_strategy: {
    quarter: string;
    intro_paragraph: string;
    strategic_focus_areas: Array<{ title: string; description: string }>;
    talking_points_spotlight: Array<{ title: string; description: string }>;
  };
  top_categories?: Array<{ name: string; count: number }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, next_quarter_strategy, top_categories } = await req.json() as RequestBody;

    if (!client || !next_quarter_strategy) {
      return new Response(
        JSON.stringify({ error: 'Client and next_quarter_strategy are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt
    const focusAreas = next_quarter_strategy.strategic_focus_areas
      .map(f => `- ${f.title}: ${f.description}`)
      .join('\n');
    
    const talkingPointsSpotlight = next_quarter_strategy.talking_points_spotlight
      .map(t => `- ${t.title}: ${t.description}`)
      .join('\n');
    
    const categoriesContext = top_categories && top_categories.length > 0
      ? `Top performing podcast categories so far: ${top_categories.map(c => c.name).join(', ')}`
      : '';

    const prompt = `You are a podcast booking strategist. Based on the following client profile and next quarter strategy, suggest 10 highly targeted real podcasts that would be excellent fits for this speaker.

## Client Profile
- Name: ${client.name}
- Company: ${client.company}
${client.title ? `- Title: ${client.title}` : ''}
${client.talking_points?.length ? `- Talking Points: ${client.talking_points.join(', ')}` : ''}
${client.target_audiences?.length ? `- Target Audiences: ${client.target_audiences.join(', ')}` : ''}
${client.campaign_strategy ? `- Campaign Strategy: ${client.campaign_strategy}` : ''}

## Next Quarter Strategy (${next_quarter_strategy.quarter})
${next_quarter_strategy.intro_paragraph}

### Strategic Focus Areas:
${focusAreas}

### Talking Points to Emphasize:
${talkingPointsSpotlight}

${categoriesContext}

## Instructions
Suggest 10 REAL, well-known podcasts that align with this speaker's expertise and the strategic focus for next quarter. For each podcast:

1. **podcast_name**: The exact name of a real, active podcast
2. **description**: 2-3 sentences on what the podcast covers and why it's a fit for this speaker
3. **pitch_angle**: A specific angle to pitch this speaker to this podcast (1-2 sentences)
4. **talking_points**: 2-3 specific talking points from the client's expertise that would resonate with this show's audience
5. **target_audience**: Which of the client's target audiences this podcast reaches
6. **apple_podcast_url**: The Apple Podcasts URL if known (optional, can be empty string)

Focus on:
- High-visibility podcasts with engaged audiences
- Shows that align with the strategic focus areas
- A mix of categories (business, tech, leadership, industry-specific)
- Podcasts known for featuring guest experts

Return ONLY real podcasts that exist and are currently active.`;

    console.log('[suggest-target-podcasts] Calling AI with prompt length:', prompt.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a podcast booking strategist with deep knowledge of the podcast landscape. Always suggest real, existing podcasts.' },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_target_podcasts',
              description: 'Return 10 targeted podcast suggestions for the next quarter.',
              parameters: {
                type: 'object',
                properties: {
                  podcasts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        podcast_name: { type: 'string', description: 'Exact name of a real podcast' },
                        description: { type: 'string', description: 'Why this podcast is a fit' },
                        pitch_angle: { type: 'string', description: 'Specific pitch angle for this show' },
                        talking_points: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: '2-3 talking points to emphasize'
                        },
                        target_audience: { type: 'string', description: 'Which target audience this reaches' },
                        apple_podcast_url: { type: 'string', description: 'Apple Podcasts URL if known' }
                      },
                      required: ['podcast_name', 'description', 'pitch_angle', 'talking_points', 'target_audience'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['podcasts'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_target_podcasts' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[suggest-target-podcasts] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[suggest-target-podcasts] AI response received');

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error('[suggest-target-podcasts] No tool call in response:', JSON.stringify(data));
      throw new Error('Invalid AI response format');
    }

    const result = JSON.parse(toolCall.function.arguments);
    const podcasts: TargetPodcastSuggestion[] = result.podcasts || [];

    console.log('[suggest-target-podcasts] Returning', podcasts.length, 'suggestions');

    return new Response(
      JSON.stringify({ success: true, podcasts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[suggest-target-podcasts] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
