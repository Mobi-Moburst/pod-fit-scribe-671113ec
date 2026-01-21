import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface GenerateRequest {
  speakers: Speaker[];
  quarter: string;
  kpis?: {
    total_booked?: number;
    total_published?: number;
    total_reach?: number;
    top_categories?: Array<{ name: string; count: number }>;
  };
  isMultiSpeaker?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { speakers, quarter, kpis, isMultiSpeaker } = await req.json() as GenerateRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!speakers || speakers.length === 0) {
      throw new Error("At least one speaker is required");
    }

    console.log(`Generating talking points for ${speakers.length} speaker(s), multi-speaker: ${isMultiSpeaker}`);

    // Build context about the campaign performance
    const campaignContext = kpis ? `
Campaign Performance Context:
- Total podcasts booked this quarter: ${kpis.total_booked || 0}
- Episodes published: ${kpis.total_published || 0}
- Total reach: ${kpis.total_reach?.toLocaleString() || 'N/A'} listeners
- Top podcast categories: ${kpis.top_categories?.slice(0, 3).map(c => c.name).join(', ') || 'Various'}
` : '';

    const results: Array<{ speaker_name: string; points: TalkingPoint[] }> = [];

    // Generate 3 talking points per speaker
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

      const systemPrompt = `You are a podcast PR strategist creating "Talking Points to Spotlight" for the next quarter strategy section of a campaign report.

Your task is to generate exactly 3 compelling, specific talking points that this speaker should emphasize in upcoming podcast appearances.

Each talking point should:
1. Be derived from the speaker's actual expertise, talking points, and professional background
2. Be timely and relevant for ${quarter} (consider current industry trends, seasonal relevance)
3. Be actionable and specific - not generic advice
4. Explain WHY this topic will resonate with podcast hosts and their audiences
5. Connect to the campaign's goals and target audiences

The talking points should position the speaker as a thought leader and give podcast hosts compelling reasons to feature them.`;

      const userPrompt = `Generate 3 talking points to spotlight for ${speaker.name} for ${quarter}.

${speakerContext}
${campaignContext}

Return ONLY a JSON array with exactly 3 objects, each with:
- "title": A concise, compelling title (max 60 characters) that captures the essence of the talking point
- "description": A brief 1-2 sentence strategic description (under 200 characters) explaining why this topic matters now. Keep it concise and complete.

Example format:
[
  {
    "title": "AI-Powered Customer Success",
    "description": "With AI adoption accelerating in 2025, position Jane as an expert on practical AI applications that drive retention and expansion."
  }
]

Focus on making these SPECIFIC to ${speaker.name}'s expertise and current market trends. Avoid generic talking points.`;

      console.log(`Generating talking points for speaker: ${speaker.name}`);

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
        
        // Fallback to speaker's talking points if AI fails
        const fallbackPoints = (speaker.talking_points || []).slice(0, 3).map(tp => ({
          title: tp.length > 60 ? tp.substring(0, 57) + '...' : tp,
          description: `Emphasize ${speaker.name}'s expertise in this area to create compelling podcast conversations.`
        }));
        
        results.push({
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

      // Parse JSON from response
      try {
        // Extract JSON array from response (handle markdown code blocks)
        let jsonStr = content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        
        const points = JSON.parse(jsonStr) as TalkingPoint[];
        
        if (Array.isArray(points) && points.length > 0) {
          // Ensure we have exactly 3 points with smart truncation at word boundaries
          const validPoints = points.slice(0, 3).map(p => {
            let title = String(p.title || '');
            let desc = String(p.description || '');
            
            // Truncate title at word boundary if needed
            if (title.length > 60) {
              title = title.substring(0, 60).replace(/\s+\S*$/, '') + '...';
            }
            
            // Truncate description at sentence or word boundary if needed
            if (desc.length > 220) {
              // Try to end at a sentence
              const truncated = desc.substring(0, 220);
              const lastPeriod = truncated.lastIndexOf('.');
              if (lastPeriod > 150) {
                desc = truncated.substring(0, lastPeriod + 1);
              } else {
                // End at word boundary
                desc = truncated.replace(/\s+\S*$/, '') + '.';
              }
            }
            
            return { title, description: desc };
          });
          
          results.push({
            speaker_name: speaker.name,
            points: validPoints
          });
          console.log(`Generated ${validPoints.length} talking points for ${speaker.name}`);
        } else {
          throw new Error('Invalid points array');
        }
      } catch (parseError) {
        console.error(`Failed to parse AI response for ${speaker.name}:`, parseError, content);
        
        // Fallback
        results.push({
          speaker_name: speaker.name,
          points: [{
            title: speaker.talking_points?.[0] || "Industry Expertise",
            description: `Emphasize ${speaker.name}'s unique perspective to create compelling conversations.`
          }]
        });
      }
    }

    // For single speaker reports, flatten to just talking_points_spotlight
    // For multi-speaker, return speaker_talking_points_spotlight
    const responseData = isMultiSpeaker || speakers.length > 1
      ? { speaker_talking_points_spotlight: results }
      : { talking_points_spotlight: results[0]?.points || [] };

    console.log('Talking points generation complete:', JSON.stringify(responseData));

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
