
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Missing OPENAI_API_KEY secret in Supabase.' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 500 });
  }
  try {
    const { client, show_notes } = await req.json();
    if (!client || !show_notes) {
      return new Response(JSON.stringify({ success: false, error: 'Missing client or show_notes' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 });
    }

    // Minimal client fields only
    const name = client?.name ?? '';
    const campaign_strategy = client?.campaign_strategy ?? '';
    const media_kit_url = client?.media_kit_url ?? '';

    const prompt = `You are evaluating PODCAST_SHOW_NOTES for fit against a minimal CLIENT_PROFILE.
Return JSON only that matches the schema. Use short direct quotes (5–12 words) from the notes where possible. Be specific and concise.

CLIENT_PROFILE (minimal):
- Name: ${name}
- Campaign Strategy: ${campaign_strategy}
- Media Kit URL: ${media_kit_url}

PODCAST_SHOW_NOTES (plain text):
${show_notes}

Considerations:
- Focus on alignment to the campaign strategy: topics, audience, angle, and potential outcomes the client cares about.
- Brand fit: infer tone/values from the strategy; if the media kit URL is provided, reference it as a source of brand guidelines but DO NOT assume you can fetch it.
- CTA synergy: whether typical episode content can naturally lead to the client's desired actions.
- If show notes contain strong misalignment or disqualifiers, explain briefly.

SCORING DIMENSIONS AND WEIGHTS:
- Topic relevance (0.35)
- Audience/ICP alignment (0.25)
- Recency/consistency (0.15)
- CTA synergy (0.15)
- Brand suitability/tone (0.10)

Apply caps/floors:
- strong avoid term → cap 5.0 (explain)
- zero positive signals for strategy alignment → cap 6.5
- strong strategy alignment across topics + audience → floor 7.5
- Round to 0.5.

JSON schema to return:
{
  "overall_score": number, 
  "rubric_breakdown": [
    {"dimension": "Topic relevance", "weight": 0.35, "raw_score": 0-10, "notes": "string with 1–2 quotes"},
    {"dimension": "ICP alignment", "weight": 0.25, "raw_score": 0-10, "notes": "string with 1–2 quotes"},
    {"dimension": "Recency/consistency", "weight": 0.15, "raw_score": 0-10, "notes": "string"},
    {"dimension": "CTA synergy", "weight": 0.15, "raw_score": 0-10, "notes": "string"},
    {"dimension": "Brand suitability", "weight": 0.10, "raw_score": 0-10, "notes": "string"}
  ],
  "why_fit": ["bullets with short quotes"],
  "why_not_fit": ["bullets with short quotes"],
  "recommended_talking_points": ["3–5 bullets tailored to client"],
  "risk_flags": ["bullets with brief rationale"],
  "citations": ["short direct phrases pulled from notes (2–6 items)"]
}`;

    const body = {
      model: 'gpt-4.1-2025-04-14',
      temperature: 0.15,
      messages: [
        { role: 'system', content: 'Be precise and concise. Return JSON ONLY. No prose.' },
        { role: 'user', content: prompt }
      ]
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content || '';

    // Try to parse JSON from response
    let data: any = null;
    try { data = JSON.parse(text); } catch (_e) {
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) { try { data = JSON.parse(m[0]); } catch {} }
    }

    if (!data) {
      return new Response(JSON.stringify({ success: false, error: 'LLM returned invalid JSON' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (_e) {
    return new Response(JSON.stringify({ success: false, error: 'Analyze error' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 500 });
  }
});
