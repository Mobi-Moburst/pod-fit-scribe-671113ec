import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Speaker {
  name: string;
  title?: string;
  company?: string;
  talking_points?: string[];
  target_audiences?: string[];
  campaign_strategy?: string;
  professional_credentials?: string[];
  guest_identity_tags?: string[];
}

interface TalkingPoint {
  title: string;
  description: string;
}

interface FocusArea {
  title: string;
  description: string;
}

interface GenerateRequest {
  speakers: Speaker[];
  quarter: string; // The NEXT quarter these talking points are for (e.g., "Q1 2026")
  reportQuarter?: string; // The quarter the report covers (e.g., "Q4 2025")
  kpis?: {
    total_booked?: number;
    total_published?: number;
    total_reach?: number;
    top_categories?: Array<{ name: string; count: number }>;
  };
  isMultiSpeaker?: boolean;
  // NEW: quarterly podcast data for grounding
  podcasts?: Array<{ show_title: string; categories?: string; show_notes?: string }>;
  // NEW: strategic quarterly notes from speaker history
  quarterly_notes?: Array<{ quarter: string; notes: string }>;
  // NEW: competitor/peer data for competitive positioning
  competitor_data?: Array<{ name: string; interview_count: number; episode_urls?: string[] }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { speakers, quarter, reportQuarter, kpis, isMultiSpeaker, podcasts, quarterly_notes, competitor_data } = await req.json() as GenerateRequest;
    
    // Get current date for temporal context
    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'long' });
    const currentYear = now.getFullYear();
    const targetQuarter = quarter || reportQuarter || `Q${Math.ceil((now.getMonth() + 1) / 3)} ${currentYear}`;
    const previousQuarter = reportQuarter || quarter;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!speakers || speakers.length === 0) {
      throw new Error("At least one speaker is required");
    }

    console.log(`Generating looking-ahead content for ${speakers.length} speaker(s), multi-speaker: ${isMultiSpeaker}`);

    // Build podcast context from actual quarterly data
    const podcastContext = podcasts && podcasts.length > 0
      ? `\nPodcasts from ${previousQuarter}:\n${podcasts.slice(0, 15).map((p) => {
          const parts = [`- "${p.show_title}"`];
          if (p.categories) parts.push(`(${p.categories})`);
          if (p.show_notes) parts.push(`— ${p.show_notes.substring(0, 150)}`);
          return parts.join(' ');
        }).join('\n')}`
      : '';

    // Build quarterly notes context
    const notesContext = quarterly_notes && quarterly_notes.length > 0
      ? `\nStrategic Notes from Campaign Manager:\n${quarterly_notes.slice(0, 5).map(n => `- [${n.quarter}] ${n.notes.substring(0, 300)}`).join('\n')}`
      : '';

    // Build competitive landscape context
    const competitorContext = competitor_data && competitor_data.length > 0
      ? `\nCompetitive Landscape (Peer Comparison):
${competitor_data.map(c => {
  const urlList = c.episode_urls && c.episode_urls.length > 0
    ? `\n    Episode URLs: ${c.episode_urls.slice(0, 5).join(', ')}`
    : '';
  return `- ${c.name}: ${c.interview_count} podcast interviews${urlList}`;
}).join('\n')}
Note: Use this peer data to recommend strategies for edging out competitors — e.g., targeting similar podcasts, differentiating messaging, or increasing placement frequency in categories where competitors are active.`
      : '';

    // Build campaign context
    const campaignContext = kpis ? `
Campaign Performance (${previousQuarter}):
- Total podcasts booked: ${kpis.total_booked || 0}
- Episodes published: ${kpis.total_published || 0}
- Total reach: ${kpis.total_reach?.toLocaleString() || 'N/A'} listeners
- Top podcast categories: ${kpis.top_categories?.slice(0, 3).map(c => c.name).join(', ') || 'Various'}
` : '';

    // Temporal context
    const timeContext = `
IMPORTANT TEMPORAL CONTEXT:
- Current date: ${currentMonth} ${currentYear}
- Report covers: ${previousQuarter}
- This content is for: ${targetQuarter} (looking ahead)
- Do NOT reference years or quarters that have already passed
- Focus on what's timely and relevant for ${targetQuarter}
`;

    const talkingPointResults: Array<{ speaker_name: string; points: TalkingPoint[] }> = [];

    // Generate per-speaker talking points
    for (const speaker of speakers) {
      const speakerContext = `
Speaker Profile:
- Name: ${speaker.name}
- Title: ${speaker.title || 'N/A'}
- Company: ${speaker.company || 'N/A'}
- Expertise/Talking Points: ${speaker.talking_points?.join('; ') || 'N/A'}
- Target Audiences: ${speaker.target_audiences?.join(', ') || 'N/A'}
- Campaign Strategy: ${speaker.campaign_strategy || 'N/A'}
- Professional Credentials: ${speaker.professional_credentials?.join(', ') || 'N/A'}
- Guest Identity Tags: ${speaker.guest_identity_tags?.join(', ') || 'N/A'}
`;

      const systemPrompt = `You are a podcast PR strategist at Kitcaster creating the "Looking Ahead" section of a quarterly campaign report. Your tone is confident, forward-looking, and grounded in podcast guesting language. Use "we" when referring to the agency's work. Refer to podcast appearances as "placements" or "appearances."`;

      const userPrompt = `Generate forward-looking content for ${speaker.name} for ${targetQuarter}, building on the momentum of ${previousQuarter}.

${timeContext}
${speakerContext}
${campaignContext}
${podcastContext}
${notesContext}

Return ONLY valid JSON (no markdown fences) with these fields:

1. "intro_paragraph" — 2-3 sentences. Forward-looking paragraph about what we're building toward in ${targetQuarter}. Ground it in what happened in ${previousQuarter} (reference actual podcast categories/themes placed) and what strategic direction we're heading. Don't be generic — reference specific category types or themes from the actual placements.

2. "strategic_focus_areas" — Array of exactly 3 objects, each with "title" (3-6 words) and "description" (1-2 sentences). These are the podcast audience segments or thematic areas to target in ${targetQuarter}. Derive them from the intersection of the speaker's profile, the actual show categories from ${previousQuarter}, and any strategic notes.${quarterly_notes && quarterly_notes.length > 0 ? ' Incorporate direction from the strategic notes.' : ''}

3. "talking_points" — Array of exactly 3 objects, each with "title" (5-8 words) and "description" (1-2 sentences). Forward-looking themes to emphasize in upcoming podcast appearances. Should build on themes that resonated in ${previousQuarter}'s placements and the speaker's expertise. Make each specific to ${speaker.name}.

4. "closing_paragraph" — 1-2 sentences. Forward-looking closing that ties the strategy together. Reference the speaker's positioning and ${targetQuarter} goals.

Make everything SPECIFIC to ${speaker.name}'s expertise and actual campaign activity. Avoid generic marketing language.`;

      console.log(`Generating looking-ahead content for speaker: ${speaker.name}`);

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
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI gateway error for ${speaker.name}:`, response.status, errorText);
        
        // Fallback talking points
        const fallbackPoints = (speaker.talking_points || []).slice(0, 3).map(tp => ({
          title: tp.length > 60 ? tp.substring(0, 57) + '...' : tp,
          description: `Emphasize ${speaker.name}'s expertise in this area to create compelling podcast conversations.`
        }));
        
        talkingPointResults.push({
          speaker_name: speaker.name,
          points: fallbackPoints.length > 0 ? fallbackPoints : [{
            title: "Industry Expertise",
            description: `Position ${speaker.name} as a thought leader in their domain.`
          }]
        });
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      try {
        let jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        
        const points = Array.isArray(parsed.talking_points) 
          ? parsed.talking_points.slice(0, 3).map((p: any) => ({
              title: String(p.title || '').trim(),
              description: String(p.description || '').trim(),
            }))
          : [];
        
        talkingPointResults.push({
          speaker_name: speaker.name,
          points: points.length > 0 ? points : [{
            title: speaker.talking_points?.[0] || "Industry Expertise",
            description: `Emphasize ${speaker.name}'s unique perspective to create compelling conversations.`
          }]
        });

        // For first speaker (or single speaker), also capture the section-level content
        if (speakers.indexOf(speaker) === 0) {
          const sectionContent: Record<string, any> = {};
          
          if (parsed.intro_paragraph) {
            sectionContent.intro_paragraph = String(parsed.intro_paragraph).trim();
          }
          if (Array.isArray(parsed.strategic_focus_areas)) {
            sectionContent.strategic_focus_areas = parsed.strategic_focus_areas.slice(0, 3).map((a: any) => ({
              title: String(a.title || '').trim(),
              description: String(a.description || '').trim(),
            }));
          }
          if (parsed.closing_paragraph) {
            sectionContent.closing_paragraph = String(parsed.closing_paragraph).trim();
          }
          
          // Store section content for the response
          (talkingPointResults as any).__sectionContent = sectionContent;
        }

        console.log(`Generated looking-ahead content for ${speaker.name}`);
      } catch (parseError) {
        console.error(`Failed to parse AI response for ${speaker.name}:`, parseError, content);
        talkingPointResults.push({
          speaker_name: speaker.name,
          points: [{
            title: speaker.talking_points?.[0] || "Industry Expertise",
            description: `Emphasize ${speaker.name}'s unique perspective to create compelling conversations.`
          }]
        });
      }
    }

    // Extract section content
    const sectionContent = (talkingPointResults as any).__sectionContent || {};
    delete (talkingPointResults as any).__sectionContent;

    // Build response
    const responseData: Record<string, any> = {};
    
    // Section-level content (intro, focus areas, closing)
    if (sectionContent.intro_paragraph) {
      responseData.intro_paragraph = sectionContent.intro_paragraph;
    }
    if (sectionContent.strategic_focus_areas) {
      responseData.strategic_focus_areas = sectionContent.strategic_focus_areas;
    }
    if (sectionContent.closing_paragraph) {
      responseData.closing_paragraph = sectionContent.closing_paragraph;
    }

    // Per-speaker talking points
    if (isMultiSpeaker || speakers.length > 1) {
      responseData.speaker_talking_points_spotlight = talkingPointResults;
    } else {
      responseData.talking_points_spotlight = talkingPointResults[0]?.points || [];
    }

    console.log('Looking-ahead generation complete:', JSON.stringify(responseData));

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating talking points:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
