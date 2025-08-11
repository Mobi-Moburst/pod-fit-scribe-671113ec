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

    const prompt = `You are evaluating PODCAST_SHOW_NOTES against CLIENT_PROFILE.\nReturn JSON only matching the schema. Pull exact short quotes (5–12 words) from the notes to justify. Be specific about which client goals/keywords were matched or missed.\n\nCLIENT_PROFILE:\n- Name: ${client.name}\n- ICP: ${client.ICP}\n- Target Roles: ${client.target_roles}\n- Company Size: ${client.target_company_sizes}\n- Regions: ${client.target_regions}\n- Prioritize Topics: ${client.topics_to_prioritize}\n- Avoid Topics: ${client.topics_to_avoid}\n- Positive Keywords: ${client.keywords_positive}\n- Negative Keywords: ${client.keywords_negative}\n- Content Goals: ${client.content_goals}\n- CTA: ${client.CTA}\n- Notes: ${client.notes}\n\nPODCAST_SHOW_NOTES (plain text):\n${show_notes}\n\nSCORING DIMENSIONS AND WEIGHTS:\n- Topic relevance (0.35)\n- Audience/ICP alignment (0.25)\n- Recency/consistency (0.15)\n- CTA synergy (0.15)\n- Brand suitability/tone (0.10)\n\nApply caps/floors:\n- strong avoid term → cap 5.0 (explain)\n- zero positive keywords → cap 6.5\n- ≥3 positive keywords + strong ICP match → floor 7.5\n- Round to 0.5.\n\nJSON schema to return:\n{\n  "overall_score": number, \n  "rubric_breakdown": [\n    {"dimension": "Topic relevance", "weight": 0.35, "raw_score": 0-10, "notes": "string with 1–2 quotes"},\n    {"dimension": "ICP alignment", "weight": 0.25, "raw_score": 0-10, "notes": "string with 1–2 quotes"},\n    {"dimension": "Recency/consistency", "weight": 0.15, "raw_score": 0-10, "notes": "string"},\n    {"dimension": "CTA synergy", "weight": 0.15, "raw_score": 0-10, "notes": "string"},\n    {"dimension": "Brand suitability", "weight": 0.10, "raw_score": 0-10, "notes": "string"}\n  ],\n  "why_fit": ["bullet strings with short quotes"],\n  "why_not_fit": ["bullet strings with short quotes"],\n  "recommended_talking_points": ["3–5 bullets tailored to client"],\n  "risk_flags": ["bullets with brief rationale"],\n  "citations": ["short direct phrases pulled from notes (2–6 items)"]\n}`;

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
    try { data = JSON.parse(text); } catch (e) {
      // Try to extract JSON code block
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) { try { data = JSON.parse(m[0]); } catch {} }
    }

    if (!data) {
      return new Response(JSON.stringify({ success: false, error: 'LLM returned invalid JSON' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Analyze error' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 500 });
  }
});
