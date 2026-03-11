const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, speaker_name, speaker_title } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Scrape the media kit page
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping media kit:', formattedUrl);

    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || 'Failed to scrape media kit' }),
        { status: scrapeRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    if (!markdown) {
      return new Response(
        JSON.stringify({ success: false, error: 'No content found on media kit page' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraped content length:', markdown.length);

    // Step 2: Extract strategy via AI
    const speakerContext = [speaker_name, speaker_title].filter(Boolean).join(', ');

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert podcast booking strategist. Given a speaker's media kit page content, extract: target audiences, talking points/themes, topics to avoid (sensitive areas, competitors, off-brand topics), and guest identity tags (demographic/identity descriptors like "woman_entrepreneur", "black_founder", "veteran", "lgbtq_leader", "immigrant_founder" — use snake_case). Be concise — each item should be 2-6 words. Return 3-5 target audiences, 3-6 talking points, 0-4 avoid items, and 0-4 identity tags.`,
          },
          {
            role: 'user',
            content: `Speaker: ${speakerContext}\n\nMedia kit content:\n${markdown.slice(0, 8000)}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_campaign_strategy',
              description: 'Extract campaign strategy details from a speaker media kit.',
              parameters: {
                type: 'object',
                properties: {
                  target_audiences: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Who this speaker should reach (e.g., "Startup Founders", "Enterprise CTOs")',
                  },
                  talking_points: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Key themes/topics the speaker covers (e.g., "AI in Education", "Scaling Remote Teams")',
                  },
                  avoid: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Topics or areas to avoid when pitching (e.g., "crypto", "competitor mentions", "politics")',
                  },
                  guest_identity_tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Identity descriptors in snake_case (e.g., "woman_entrepreneur", "black_founder", "veteran")',
                  },
                },
                required: ['target_audiences', 'talking_points', 'avoid', 'guest_identity_tags'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_campaign_strategy' } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI gateway error:', aiRes.status, errText);

      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limited — please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted — please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error('No tool call in AI response:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ success: false, error: 'AI did not return structured data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log('Extracted strategy:', JSON.stringify(extracted));

    return new Response(
      JSON.stringify({
        success: true,
        target_audiences: extracted.target_audiences || [],
        talking_points: extracted.talking_points || [],
        avoid: extracted.avoid || [],
        guest_identity_tags: extracted.guest_identity_tags || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
