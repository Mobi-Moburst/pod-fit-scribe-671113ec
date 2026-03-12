import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client } = await req.json();
    
    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Client data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build client context for prompt
    const clientContext = `
Client Profile:
- Name: ${client.name || 'Unknown'}
- Title: ${client.title || 'Not specified'}
- Company: ${client.company || 'Not specified'}
- Talking Points: ${(client.talking_points || []).join(', ') || 'Not specified'}
- Target Audiences: ${(client.target_audiences || []).join(', ') || 'Not specified'}
- Campaign Strategy: ${client.campaign_strategy || 'Not specified'}
- Notes: ${client.notes || 'Not specified'}
`.trim();

    const prompt = `Given the profile of this client, analyze their thought leadership focus, audience, and industry orientation. Then identify three real-world thought leaders or executives who compete for share-of-voice in those same topics, audiences, and transformation narratives.

Exclude individuals whose public influence is disproportionately larger than the client's (e.g., global figures, industry icons, or macro influencers) unless they are a realistic peer for share-of-voice or positioning comparison.

${clientContext}

Return exactly 3 competitors with:
- name: Full name
- role: Their title and company
- peer_reason: 1-2 sentences explaining why they compete for the same SOV
- linkedin_url: Their LinkedIn profile URL (best guess based on your knowledge)`;

    console.log('[suggest-competitors] Calling Lovable AI with prompt');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_competitors',
              description: 'Return 3 peer thought leaders who compete for share-of-voice',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Full name' },
                        role: { type: 'string', description: 'Title and company' },
                        peer_reason: { type: 'string', description: 'Why they compete for same SOV' },
                        linkedin_url: { type: 'string', description: 'LinkedIn profile URL' }
                      },
                      required: ['name', 'role', 'peer_reason', 'linkedin_url'],
                      additionalProperties: false
                    },
                    minItems: 3,
                    maxItems: 3
                  }
                },
                required: ['suggestions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_competitors' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[suggest-competitors] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate competitor suggestions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[suggest-competitors] AI response received');

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('[suggest-competitors] No tool call in response');
      return new Response(
        JSON.stringify({ error: 'Invalid AI response format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    console.log('[suggest-competitors] Parsed suggestions:', suggestions);

    return new Response(
      JSON.stringify({ suggestions: suggestions.suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[suggest-competitors] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
