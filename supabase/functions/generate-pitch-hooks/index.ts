import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpeakerProfile {
  name: string;
  title?: string;
  company?: string;
  target_audiences?: string[];
  talking_points?: string[];
  campaign_strategy?: string;
  professional_credentials?: string[];
  guest_identity_tags?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { speaker } = await req.json() as { speaker: SpeakerProfile };
    
    if (!speaker || !speaker.name) {
      return new Response(
        JSON.stringify({ error: 'Speaker profile with name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert podcast PR strategist who creates compelling pitch hooks for podcast guests. Your hooks should be:
- Concise (5-10 words each)
- Action or insight-focused
- Tailored to the speaker's unique expertise and goals
- Designed to capture podcast host interest immediately
- Varied in angle to appeal to different podcast audiences`;

    const speakerContext = `
Speaker Profile:
- Name: ${speaker.name}
- Title: ${speaker.title || 'Not specified'}
- Company: ${speaker.company || 'Not specified'}
- Target Audiences: ${speaker.target_audiences?.join(', ') || 'General business audience'}
- Key Talking Points: ${speaker.talking_points?.join('; ') || 'Not specified'}
- Campaign Strategy: ${speaker.campaign_strategy || 'Not specified'}
- Professional Credentials: ${speaker.professional_credentials?.join(', ') || 'Not specified'}
- Guest Identity Tags: ${speaker.guest_identity_tags?.join(', ') || 'Not specified'}

Generate 3-4 fresh, compelling pitch hooks for this speaker that would resonate with podcast hosts. Each hook should offer a different angle on the speaker's expertise.`;

    console.log('Generating pitch hooks for:', speaker.name);

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
          { role: 'user', content: speakerContext }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_pitch_hooks',
              description: 'Return the generated pitch hooks for the speaker',
              parameters: {
                type: 'object',
                properties: {
                  hooks: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 3-4 pitch hooks, each 5-10 words'
                  }
                },
                required: ['hooks'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_pitch_hooks' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data));

    // Extract hooks from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      console.log('Generated hooks:', args.hooks);
      return new Response(
        JSON.stringify({ hooks: args.hooks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: try to parse from content if tool call didn't work
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      // Try to extract hooks from text response
      const lines = content.split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('•'));
      const hooks = lines.map((l: string) => l.replace(/^[-•]\s*/, '').trim()).filter((h: string) => h.length > 0);
      if (hooks.length > 0) {
        console.log('Extracted hooks from content:', hooks);
        return new Response(
          JSON.stringify({ hooks: hooks.slice(0, 4) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    throw new Error('Failed to parse hooks from AI response');
  } catch (error) {
    console.error('Error generating pitch hooks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
