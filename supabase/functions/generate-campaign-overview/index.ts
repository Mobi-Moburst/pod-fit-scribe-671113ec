import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { speaker, podcasts, kpis, quarter } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build podcast context — truncate show notes to keep prompt manageable
    const podcastSummaries = (podcasts || []).slice(0, 20).map((p: any) => {
      const parts = [`- "${p.show_title}"`];
      if (p.categories) parts.push(`(${p.categories})`);
      if (p.show_notes) parts.push(`— ${p.show_notes.substring(0, 200)}`);
      return parts.join(' ');
    }).join('\n');

    const speakerContext = [
      `Name: ${speaker.name}`,
      speaker.title ? `Title: ${speaker.title}` : '',
      speaker.company ? `Company: ${speaker.company}` : '',
      speaker.target_audiences?.length ? `Target audiences: ${speaker.target_audiences.join(', ')}` : '',
      speaker.talking_points?.length ? `Profile talking points: ${speaker.talking_points.join('; ')}` : '',
      speaker.professional_credentials?.length ? `Credentials: ${speaker.professional_credentials.join(', ')}` : '',
      speaker.campaign_strategy ? `Campaign strategy: ${speaker.campaign_strategy.substring(0, 500)}` : '',
    ].filter(Boolean).join('\n');

    const kpiContext = [
      `Total booked: ${kpis.total_booked || 0}`,
      `Total published: ${kpis.total_published || 0}`,
      `Total reach (monthly listeners): ${kpis.total_reach || 0}`,
      kpis.top_categories?.length ? `Top categories: ${kpis.top_categories.map((c: any) => c.name).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are a campaign strategist at a podcast guest booking agency called Kitcaster. You write concise, professional campaign summaries for quarterly client reports. Your tone is confident, data-informed, and centered around podcast guesting — never generic marketing language. Use "we" when referring to the agency's work. Refer to podcast appearances as "placements" or "appearances", not "campaigns."`;

    const userPrompt = `Write a campaign overview for ${quarter || 'this quarter'}.

SPEAKER PROFILE:
${speakerContext}

PODCASTS BOOKED/PUBLISHED THIS QUARTER:
${podcastSummaries || 'No podcast data available.'}

KPIs:
${kpiContext}

Return a JSON object with exactly two fields:
1. "strategy" — A 2-3 sentence paragraph summarizing the quarter's podcast guesting strategy. Ground it in what actually happened: which types of shows were targeted, what themes emerged from the placements, and how the speaker was positioned. Do NOT use generic phrases like "thought leader" without specificity. Reference actual podcast categories or themes from the shows listed above.

2. "talking_points" — An array of exactly 3 strings. Each is a concise theme (1 short sentence) that actually surfaced across this quarter's podcast appearances, cross-referenced with the speaker's expertise. These should reflect what was discussed, not just profile bullet points.

Return ONLY valid JSON, no markdown fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle potential markdown fences)
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      strategy: parsed.strategy || '',
      talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points.slice(0, 3) : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-campaign-overview error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

