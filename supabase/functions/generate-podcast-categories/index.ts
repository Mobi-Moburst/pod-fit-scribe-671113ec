import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PodcastInput {
  name: string;
  description?: string;
  apple_link?: string;
  cover_art_url?: string;
}

interface CategoryOutput {
  name: string;
  podcasts: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { podcasts, targetAudiences, companyName } = await req.json();

    if (!podcasts || !Array.isArray(podcasts) || podcasts.length === 0) {
      return new Response(
        JSON.stringify({ error: "podcasts array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build podcast list for prompt
    const podcastList = podcasts
      .map((p: PodcastInput, i: number) => {
        const desc = p.description ? ` - ${p.description.substring(0, 200)}${p.description.length > 200 ? '...' : ''}` : '';
        return `${i + 1}. "${p.name}"${desc}`;
      })
      .join('\n');

    // Build reference audiences context
    const audienceContext = targetAudiences && targetAudiences.length > 0
      ? `\nThe client's target audiences for reference (use as inspiration, not constraints):\n${targetAudiences.slice(0, 10).map((a: string) => `- ${a}`).join('\n')}`
      : '';

    const systemPrompt = `You are an expert at categorizing podcasts by their TARGET AUDIENCE for campaign reports. Your job is to analyze podcasts and group them into clean, professional category names.

CRITICAL RULES:
1. Categories should describe WHO LISTENS to the podcast (the audience), NOT what topics are discussed
2. Keep category names short (2-5 words max)
3. Use professional, business-oriented language
4. Categories should be mutually exclusive - each podcast goes in exactly one category
5. Generate 4-8 categories maximum, depending on how many distinct audiences exist

GOOD category names (these describe the AUDIENCE):
- "Startup Founders & CEOs"
- "Marketing & Growth Leaders"
- "Sales & Revenue Teams"
- "Agency & Service Leaders"
- "Enterprise Executives"
- "Tech & Product Leaders"
- "Entrepreneurs & SMB Owners"
- "VC & Investment Community"
- "Operations & Strategy Leaders"
- "HR & People Leaders"

BAD category names (these describe TOPICS or TALKING POINTS - DO NOT USE):
- "Lessons from Building and Selling an Agency" ❌
- "PR as a Growth Engine, Not Just a Megaphone" ❌
- "The Future of Marketing" ❌
- "How to Scale Your Business" ❌
- "Building High-Performance Teams" ❌
- "AI and Automation Insights" ❌`;

    const userPrompt = `Categorize the following ${podcasts.length} podcasts for a campaign report${companyName ? ` for ${companyName}` : ''}.
${audienceContext}

PODCASTS TO CATEGORIZE:
${podcastList}

Group these podcasts into 4-8 clean, audience-focused categories. Each podcast should be assigned to exactly one category.`;

    console.log(`Generating categories for ${podcasts.length} podcasts`);

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
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "categorize_podcasts",
              description: "Return podcast categories with their assigned podcasts",
              parameters: {
                type: "object",
                properties: {
                  categories: {
                    type: "array",
                    description: "List of audience-focused categories",
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Short, audience-focused category name (2-5 words)"
                        },
                        podcasts: {
                          type: "array",
                          items: { type: "string" },
                          description: "Names of podcasts in this category (must match exactly)"
                        }
                      },
                      required: ["name", "podcasts"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["categories"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "categorize_podcasts" } }
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error(`AI gateway error: ${status}`, errorText);
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate categories" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "categorize_podcasts") {
      console.error("Unexpected AI response format:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Invalid AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let categories: CategoryOutput[];
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      categories = parsed.categories;
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and normalize - ensure all podcasts are assigned
    const assignedPodcasts = new Set<string>();
    categories.forEach(cat => {
      cat.podcasts.forEach(p => assignedPodcasts.add(p.toLowerCase()));
    });

    // Check for unassigned podcasts and add to "Other" category if needed
    const unassigned = podcasts.filter((p: PodcastInput) => 
      !assignedPodcasts.has(p.name.toLowerCase())
    );

    if (unassigned.length > 0) {
      console.log(`${unassigned.length} podcasts were not assigned, adding to fallback category`);
      const existingOther = categories.find(c => 
        c.name.toLowerCase().includes('other') || c.name.toLowerCase().includes('general')
      );
      if (existingOther) {
        existingOther.podcasts.push(...unassigned.map((p: PodcastInput) => p.name));
      } else {
        categories.push({
          name: "Industry Podcasts",
          podcasts: unassigned.map((p: PodcastInput) => p.name)
        });
      }
    }

    console.log(`Generated ${categories.length} categories for ${podcasts.length} podcasts`);

    return new Response(
      JSON.stringify({ categories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-podcast-categories:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
