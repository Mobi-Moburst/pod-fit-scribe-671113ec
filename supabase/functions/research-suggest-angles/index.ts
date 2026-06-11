import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });

    const { shortlist_id } = await req.json();
    if (!shortlist_id) {
      return new Response(JSON.stringify({ error: 'shortlist_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: row, error: rErr } = await supabase
      .from('research_shortlists').select('*').eq('id', shortlist_id).single();
    if (rErr || !row) throw new Error(`Shortlist row not found: ${rErr?.message}`);

    const { data: speaker, error: sErr } = await supabase
      .from('speakers').select('*, companies(*)').eq('id', row.speaker_id).single();
    if (sErr || !speaker) throw new Error(`Speaker not found: ${sErr?.message}`);

    const company = (speaker as any).companies;

    const prompt = `You are a podcast pitch strategist. Generate 4 DISTINCT pitch angles a campaign manager could use to pitch this speaker to this specific podcast.

These are angle IDEAS — short hooks the CM will adapt into their existing HubSpot template. NOT a finished pitch. NOT subject lines. NOT email bodies. Just angles.

## Speaker
- ${speaker.name}${speaker.title ? `, ${speaker.title}` : ''} at ${company?.name || ''}
${speaker.target_audiences?.length ? `- Target audiences: ${speaker.target_audiences.join(', ')}` : ''}
${speaker.talking_points?.length ? `- Talking points: ${speaker.talking_points.slice(0, 8).join(' | ')}` : ''}
${speaker.guest_identity_tags?.length ? `- Identity: ${speaker.guest_identity_tags.join(', ')}` : ''}
${speaker.campaign_strategy ? `- Strategy: ${String(speaker.campaign_strategy).slice(0, 500)}` : ''}

## Podcast
- ${row.show_name}${row.host_name ? `, hosted by ${row.host_name}` : ''}
- ${row.description || ''}
${row.niche_tag ? `- Niche: ${row.niche_tag}` : ''}
${row.categories?.length ? `- Categories: ${row.categories.join(', ')}` : ''}

## Output rules
- 4 angles, each DIFFERENT in framing (e.g. contrarian take, story-driven, data/insight-driven, "case study from the trenches")
- headline = ONE punchy line, max 14 words, written as a topic hook the host would actually find interesting
- rationale = 1 short paragraph (2–4 sentences) explaining why this specific angle works for THIS show's audience, grounded in the speaker's expertise
- Do NOT write subject lines, email greetings, "Hi [name]", or pitch openers
- Do NOT mention "pitch" or "guest spot" in the headline — it should read like an episode topic`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You generate distinct, audience-tuned podcast pitch angles. Never write finished pitches.' },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_angles',
            parameters: {
              type: 'object',
              properties: {
                angles: {
                  type: 'array',
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    properties: {
                      headline: { type: 'string' },
                      rationale: { type: 'string' },
                    },
                    required: ['headline', 'rationale'],
                  },
                },
              },
              required: ['angles'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_angles' } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('[research-suggest-angles] AI error:', resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI error: ${resp.status}`);
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error('Invalid AI response');
    const { angles } = JSON.parse(toolCall.function.arguments);

    // Delete prior angles for this shortlist row and insert new ones
    await supabase.from('research_angles').delete().eq('shortlist_id', shortlist_id);
    const inserts = (angles || []).map((a: any) => ({
      shortlist_id,
      org_id: row.org_id,
      headline: a.headline,
      rationale: a.rationale,
    }));
    const { data: inserted, error: iErr } = await supabase
      .from('research_angles').insert(inserts).select();
    if (iErr) throw new Error(`Insert failed: ${iErr.message}`);

    return new Response(
      JSON.stringify({ success: true, angles: inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[research-suggest-angles] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
