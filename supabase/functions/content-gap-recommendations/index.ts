import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, gap_analysis } = await req.json();
    
    console.log('[content-gap-recommendations] Received request for:', client?.name);
    console.log('[content-gap-recommendations] Gap analysis summary:', {
      total_gaps: gap_analysis?.total_gaps,
      coverage: gap_analysis?.coverage_percentage,
      top_topics: gap_analysis?.gaps_by_topic?.length,
      priority_prompts: gap_analysis?.priority_prompts?.length,
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context from gap analysis
    const topGapTopics = gap_analysis.gaps_by_topic
      ?.slice(0, 5)
      .map((t: any) => `${t.topic} (${t.gap_count} gaps)`)
      .join(', ') || 'No topics identified';

    const topCompetitors = gap_analysis.top_competitors
      ?.slice(0, 5)
      .map((c: any) => c.name)
      .join(', ') || 'No competitors identified';

    const priorityPrompts = gap_analysis.priority_prompts
      ?.slice(0, 5)
      .map((p: any) => `"${p.prompt}" (${p.topic})`)
      .join('\n- ') || 'No priority prompts';

    const stageBreakdown = gap_analysis.gaps_by_stage
      ?.map((s: any) => `${s.stage}: ${s.gap_count}/${s.total} gaps`)
      .join(', ') || 'No stage data';

    const systemPrompt = `You are a podcast campaign strategist specializing in thought leadership positioning. Your task is to analyze content gaps in AI search visibility and provide actionable recommendations for podcast guest appearances.

Focus on:
1. Identifying podcast topics that would address the content gaps
2. Suggesting talking points that position the client as an authority
3. Recommending specific angles to compete with mentioned competitors
4. Prioritizing by customer journey stage (awareness > consideration > decision)

Keep recommendations specific, actionable, and tied to podcast appearances.`;

    const userPrompt = `Analyze the content gap data for ${client.name}${client.title ? `, ${client.title}` : ''}${client.company ? ` at ${client.company}` : ''} and provide podcast campaign recommendations.

## Client Profile
- Talking Points: ${client.talking_points?.join(', ') || 'Not specified'}
- Target Audiences: ${client.target_audiences?.join(', ') || 'Not specified'}
- Campaign Strategy: ${client.campaign_strategy || 'Not specified'}

## Content Gap Analysis
- Overall Coverage: ${gap_analysis.coverage_percentage}% (${gap_analysis.total_gaps} gaps)
- Gap Distribution by Stage: ${stageBreakdown}
- Top Gap Topics: ${topGapTopics}
- Top Competitors Appearing: ${topCompetitors}

## Priority Prompts (Where Client is Missing):
- ${priorityPrompts}

Based on this analysis, provide 3-5 strategic recommendations for the podcast campaign. Each recommendation should address specific content gaps and position the client to compete with visible competitors.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'provide_recommendations',
              description: 'Provide structured podcast campaign recommendations based on content gap analysis',
              parameters: {
                type: 'object',
                properties: {
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { 
                          type: 'string',
                          description: 'Short, actionable title (e.g., "Target AI Security Decision Makers")'
                        },
                        description: { 
                          type: 'string',
                          description: '2-3 sentence recommendation explaining the strategy and expected impact'
                        },
                        priority: { 
                          type: 'string', 
                          enum: ['high', 'medium', 'low'],
                          description: 'Priority based on gap severity and potential impact'
                        },
                        related_topics: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Which gap topics this recommendation addresses'
                        }
                      },
                      required: ['title', 'description', 'priority', 'related_topics'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['recommendations'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_recommendations' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[content-gap-recommendations] AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[content-gap-recommendations] AI response:', JSON.stringify(data).substring(0, 500));

    // Extract recommendations from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('No recommendations returned from AI');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const recommendations = parsed.recommendations || [];

    console.log('[content-gap-recommendations] Generated recommendations:', recommendations.length);

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[content-gap-recommendations] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
