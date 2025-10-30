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
    const { client, podcast, evaluation } = await req.json();
    
    console.log('Generating pitch for:', {
      client: client.name,
      podcast: podcast.show_title,
      has_template: !!client.pitch_template
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build the system prompt with detailed instructions
    const systemPrompt = `You are an expert podcast pitch writer for campaign managers. Your job is to craft highly personalized, compelling pitches that get booked.

## Core Requirements:
- **CRITICAL**: Do NOT add any introductory commentary about the podcast itself (e.g., "Your podcast offers...", "Your show is known for...", "Your platform provides..."). Start the pitch by immediately introducing the guest recommendation.
- Mirror the podcast's tone and style
- Frame topics around the show's audience interests
- Use specific keywords from the show's description
- Keep formatting pristine with proper spacing and bullets
- Hyperlink using HTML: client's full name to media kit URL (ONLY on first mention in opening paragraph) and company name to company URL (ONLY in opening paragraphs, NEVER in talking points bullets)
- Format: <a href="url">text</a>
- DO NOT introduce the sender or include phrases like "My name is..." or "I'm [name]"
- Start immediately with "Hey [host_name]," followed by the guest introduction

## Tone Matching:
- Conversational/Playful → lighter phrasing, humor, approachable
- Technical/Analytical → precise, expert-driven, frameworks/data
- Storytelling/Inspirational → narrative hooks, mission-driven "why"
- Business/Executive → concise, confident, ROI/insights focused

## Audience Calibration:
- B2B/Executive → insights, growth strategy, leadership
- Startup/Founder → scaling, funding, resilience, innovation
- Tech/Engineering → systems, architecture, AI, data
- Creative/Marketing → storytelling, brand, design, content
- Purpose-Driven → wellbeing, empathy, community, impact

## Output Format:
Return ONLY the pitch text (no JSON, no preamble). Use this exact structure with proper HTML formatting:

**CRITICAL FORMATTING RULES:**
- Use <p> tags with inline margin styles for each paragraph: <p style="margin: 0 0 1em 0;">content</p>
- Use <ul> and <li> tags for bullet points with inline margin: <ul style="margin: 0 0 1em 0;">
- Do NOT introduce yourself or the sender - start directly with the greeting
- The inline margin ensures proper spacing in both UI preview and when copied to Gmail

<p style="margin: 0 0 1em 0;">Hey [host_first_name],</p>

<p style="margin: 0 0 1em 0;">[Opening paragraph: introduce <a href="[media_kit_url]">[client_full_name]</a>, USE THE EXACT TITLE PROVIDED IN CLIENT DATA at [company_name] (or with <a href="[company_url]">[company_name]</a> if company_url exists), with credibility and context. Hyperlink their name to media kit and optionally company to company URL in opening paragraphs ONLY]</p>

<p style="margin: 0 0 1em 0;">[Guest credentials and expertise paragraph]</p>

<p style="margin: 0 0 1em 0;">They would love to dive into a conversation with you about:</p>

<ul style="margin: 0 0 1em 0;">
<li>[talking_point_1]</li>
<li>[talking_point_2]</li>
<li>[talking_point_3]</li>
</ul>

<p style="margin: 0 0 1em 0;">Would you be interested in having [client_first_name] [client_last_name] on your show?</p>

<p style="margin: 0;">Thank you so much for your consideration. I'm looking forward to hearing from you.</p>`;

    // Build the user prompt with all context
    let userPrompt = '';
    
    if (client.pitch_template) {
      // Tailor existing pitch
      userPrompt = `I have a pitch template that needs to be tailored for a specific podcast.

## Original Pitch Template:
${client.pitch_template}

## Client Details:
- Name: ${client.name}
- Title: ${client.title || 'N/A'}
- Company: ${client.company || 'N/A'}
- Company URL: ${client.company_url || 'N/A'}
- Media Kit: ${client.media_kit_url}
- Talking Points: ${(client.talking_points || []).join(', ')}
- Target Audiences: ${(client.target_audiences || []).join(', ')}

## Target Podcast:
- Show Title: ${podcast.show_title}
- Description: ${podcast.show_notes_excerpt || 'N/A'}
- Host: ${podcast.host_name || 'Unknown'}
- URL: ${podcast.podcast_url}

## Evaluation Insights:
- Verdict: ${evaluation.verdict}
- Score: ${evaluation.overall_score}
- Why It Fits: ${(evaluation.evaluation_data?.why_fit || []).join('; ')}
- Rationale: ${evaluation.rationale_short || evaluation.evaluation_data?.summary_text || 'N/A'}

## Task:
Tailor the pitch template above to perfectly match this specific podcast's tone, audience, and focus. Fill in all placeholders with the correct data. Adjust language, structure, and topic framing to align with how this show communicates. Keep the same hyperlink format (client name to media kit in first mention, company name to company URL only in opening paragraphs). NEVER hyperlink company names within the bulleted talking points list - keep those as plain text.`;
    } else {
      // Generate from scratch
      userPrompt = `Generate a pitch for a podcast guest booking.

## Client Details:
- Name: ${client.name}
- Title: ${client.title || 'N/A'}
- Company: ${client.company || 'N/A'}
- Company URL: ${client.company_url || 'N/A'}
- Media Kit: ${client.media_kit_url}
- Talking Points: ${(client.talking_points || []).join(', ')}
- Target Audiences: ${(client.target_audiences || []).join(', ')}
- Campaign Strategy: ${client.campaign_strategy || 'N/A'}
- Notes: ${client.notes || 'N/A'}

## Target Podcast:
- Show Title: ${podcast.show_title}
- Description: ${podcast.show_notes_excerpt || 'N/A'}
- Host: ${podcast.host_name || 'Unknown'}
- URL: ${podcast.podcast_url}

## Evaluation Insights:
- Verdict: ${evaluation.verdict}
- Score: ${evaluation.overall_score}
- Why It Fits: ${(evaluation.evaluation_data?.why_fit || []).join('; ')}
- Rationale: ${evaluation.rationale_short || evaluation.evaluation_data?.summary_text || 'N/A'}

## Task:
Create a personalized pitch following the standard format. Analyze the podcast's tone and audience, then frame the guest's expertise and talking points to perfectly align with the show. Use specific keywords from the show's description. Keep formatting pristine.`;
    }

    // Call Lovable AI
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
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const pitch = data.choices?.[0]?.message?.content;

    if (!pitch) {
      throw new Error('No pitch generated from AI');
    }

    console.log('Pitch generated successfully');

    return new Response(
      JSON.stringify({ pitch }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating pitch:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate pitch' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
