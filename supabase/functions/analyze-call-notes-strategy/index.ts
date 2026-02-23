import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { speaker_id } = await req.json();
    if (!speaker_id) {
      return new Response(
        JSON.stringify({ error: "speaker_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch speaker
    const { data: speaker, error: spErr } = await sb
      .from("speakers")
      .select("name, title, campaign_strategy, target_audiences, talking_points, avoid, guest_identity_tags, professional_credentials, company_id, pitch_template")
      .eq("id", speaker_id)
      .single();

    if (spErr || !speaker) {
      return new Response(
        JSON.stringify({ error: "Speaker not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch company name
    const { data: company } = await sb
      .from("companies")
      .select("name")
      .eq("id", speaker.company_id)
      .single();

    // Fetch recent call notes (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: callNotes } = await sb
      .from("call_notes")
      .select("meeting_title, meeting_date, summary, action_items")
      .eq("speaker_id", speaker_id)
      .gte("meeting_date", ninetyDaysAgo.toISOString())
      .order("meeting_date", { ascending: false })
      .limit(15);

    if (!callNotes || callNotes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recent call notes found for this speaker (last 90 days)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context
    const notesContext = callNotes
      .map((n: any, i: number) => {
        const items = Array.isArray(n.action_items) && n.action_items.length > 0
          ? `\nAction items: ${n.action_items.map((a: any) => typeof a === "string" ? a : a.text || JSON.stringify(a)).join("; ")}`
          : "";
        return `--- Call ${i + 1}: "${n.meeting_title || "Untitled"}" (${n.meeting_date || "unknown date"}) ---\n${n.summary || "No summary"}${items}`;
      })
      .join("\n\n");

    const systemPrompt = `You are a senior podcast PR strategist analyzing client call notes to extract actionable campaign insights. You work at a podcast booking agency. Your job is to review recent meeting notes with a client and identify:

1. Strategy Updates - new target audiences, talking points, or positioning shifts that emerged from conversations
2. Pitch Angle Ideas - fresh, compelling pitch hooks (5-10 words each) inspired by what was discussed  
3. Quarterly Summary - a 2-3 sentence high-level summary of strategic themes and key decisions from these calls

Be specific and actionable. Pull directly from what was discussed in the calls. Don't repeat existing strategy items the speaker already has.`;

    const userPrompt = `Speaker: ${speaker.name}${speaker.title ? `, ${speaker.title}` : ""}${company?.name ? ` at ${company.name}` : ""}

Current Strategy:
${speaker.campaign_strategy || "No strategy set yet"}

Current Target Audiences: ${(speaker.target_audiences || []).join(", ") || "None set"}
Current Talking Points: ${(speaker.talking_points || []).join(", ") || "None set"}
Topics to Avoid: ${(speaker.avoid || []).join(", ") || "None set"}${speaker.pitch_template ? `\nExample Pitch:\n${speaker.pitch_template}` : ""}

Recent Call Notes (${callNotes.length} calls, last 90 days):

${notesContext}

Analyze these call notes and extract strategy insights. Focus on NEW information not already captured in the current strategy.`;

    console.log(`Analyzing ${callNotes.length} call notes for speaker: ${speaker.name}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_strategy_insights",
              description: "Return structured strategy insights extracted from call notes",
              parameters: {
                type: "object",
                properties: {
                  strategy_updates: {
                    type: "object",
                    properties: {
                      new_audiences: {
                        type: "array",
                        items: { type: "string" },
                        description: "Suggested new target audiences not already in the speaker's list",
                      },
                      new_talking_points: {
                        type: "array",
                        items: { type: "string" },
                        description: "Suggested new talking points not already in the speaker's list",
                      },
                      positioning_shifts: {
                        type: "array",
                        items: { type: "string" },
                        description: "Broader strategic observations or positioning changes to consider",
                      },
                    },
                    required: ["new_audiences", "new_talking_points", "positioning_shifts"],
                    additionalProperties: false,
                  },
                  pitch_angles: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 fresh pitch hooks (5-10 words each) inspired by call discussions",
                  },
                  quarterly_summary: {
                    type: "string",
                    description: "2-3 sentence high-level summary of strategic themes and decisions from recent calls",
                  },
                },
                required: ["strategy_updates", "pitch_angles", "quarterly_summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_strategy_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const insights = JSON.parse(toolCall.function.arguments);
      console.log("Generated insights:", JSON.stringify(insights));
      return new Response(JSON.stringify(insights), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to parse insights from AI response");
  } catch (error) {
    console.error("Error analyzing call notes:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
