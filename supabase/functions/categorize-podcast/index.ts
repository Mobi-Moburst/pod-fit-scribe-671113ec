import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { podcastName, podcastDescription, targetAudiences, companyName } = await req.json();

    if (!podcastName || !targetAudiences || targetAudiences.length === 0) {
      return new Response(
        JSON.stringify({ error: 'podcastName and targetAudiences are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the prompt
    const audienceList = targetAudiences.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n');
    
    const prompt = `You are categorizing podcasts for a B2B podcast booking campaign${companyName ? ` for ${companyName}` : ''}.

The client's target audiences are:
${audienceList}

Podcast to categorize:
Name: ${podcastName}
${podcastDescription ? `Description: ${podcastDescription}` : ''}

Based on the podcast's name and description, which of the client's target audience categories is the BEST fit?

IMPORTANT: 
- Return ONLY the exact category name from the list above that best matches
- If none fit well, return the closest match
- Do not add any explanation, just the category name`;

    console.log(`[categorize-podcast] Categorizing "${podcastName}" for audiences: ${targetAudiences.join(', ')}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI categorization failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const rawCategory = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Normalize: find the best matching target audience
    const normalizedCategory = normalizeToTargetAudience(rawCategory, targetAudiences);
    
    console.log(`[categorize-podcast] Result: "${podcastName}" -> "${normalizedCategory}" (raw: "${rawCategory}")`);

    return new Response(
      JSON.stringify({ 
        category: normalizedCategory,
        rawResponse: rawCategory 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in categorize-podcast:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Normalize AI response to match one of the target audiences
function normalizeToTargetAudience(rawCategory: string, targetAudiences: string[]): string {
  const normalized = rawCategory.toLowerCase().trim();
  
  // Exact match (case-insensitive)
  for (const audience of targetAudiences) {
    if (audience.toLowerCase() === normalized) {
      return audience;
    }
  }
  
  // Partial match - check if the raw category contains or is contained by a target audience
  for (const audience of targetAudiences) {
    const audienceLower = audience.toLowerCase();
    if (normalized.includes(audienceLower) || audienceLower.includes(normalized)) {
      return audience;
    }
  }
  
  // Keyword matching - extract key terms and find best match
  const rawKeywords = extractKeywords(normalized);
  let bestMatch = targetAudiences[0];
  let bestScore = 0;
  
  for (const audience of targetAudiences) {
    const audienceKeywords = extractKeywords(audience.toLowerCase());
    const score = calculateKeywordOverlap(rawKeywords, audienceKeywords);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = audience;
    }
  }
  
  return bestMatch;
}

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  return new Set(
    text
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
}

function calculateKeywordOverlap(set1: Set<string>, set2: Set<string>): number {
  let overlap = 0;
  for (const word of set1) {
    if (set2.has(word)) overlap++;
    // Partial word matching (e.g., "security" matches "secure")
    for (const word2 of set2) {
      if (word !== word2 && (word.includes(word2) || word2.includes(word))) {
        overlap += 0.5;
      }
    }
  }
  return overlap;
}
