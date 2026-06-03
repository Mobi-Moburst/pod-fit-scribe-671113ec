import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawSuggestion {
  podcast_name: string;
  host_name?: string;
  description: string;
  why_it_fits: string;
  target_audience?: string;
  niche_tag?: string;
  is_interview_format: boolean;
  est_listeners_range: 'micro' | 'small' | 'mid';
}

interface HydratedCandidate {
  show_name: string;
  host_name?: string;
  description: string;
  apple_podcast_url?: string;
  cover_art_url?: string;
  itunes_id?: string;
  categories?: string[];
  est_listeners?: number;
  last_episode_date?: string;
  guest_cadence_score: number;
  guest_cadence_label: string;
  niche_fit_score: number;
  fit_rationale: string;
  niche_tag?: string;
  dropped_reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const REPHONIC_API_KEY = Deno.env.get('REPHONIC_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });

    const { speaker_id, num = 25, listener_min = 500, listener_max = 50000 } = await req.json();

    if (!speaker_id) {
      return new Response(JSON.stringify({ error: 'speaker_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch speaker + company context
    const { data: speaker, error: sErr } = await supabase
      .from('speakers').select('*, companies(*)').eq('id', speaker_id).single();
    if (sErr || !speaker) throw new Error(`Speaker not found: ${sErr?.message}`);

    // Fetch already-shortlisted shows (exclude from results)
    const { data: existing } = await supabase
      .from('research_shortlists')
      .select('show_name')
      .eq('speaker_id', speaker_id);
    const excludeNames = new Set((existing || []).map((r: any) => r.show_name.toLowerCase()));

    // Fetch already-booked shows from this speaker's evaluations (read-only, no Airtable write)
    const { data: pastBookings } = await supabase
      .from('evaluations')
      .select('show_title')
      .eq('speaker_id', speaker_id)
      .limit(500);
    (pastBookings || []).forEach((r: any) => r.show_title && excludeNames.add(r.show_title.toLowerCase()));

    const company = (speaker as any).companies;

    // Build prompt
    const prompt = `You are a podcast-sourcing researcher for a niche guest-booking agency. Your job is to surface ${num} SMALL, NICHE podcasts that ACTIVELY BOOK GUEST EXPERTS and would realistically book this speaker.

## Speaker
- Name: ${speaker.name}${speaker.title ? ` (${speaker.title})` : ''}
- Company: ${company?.name || 'Unknown'}${company?.industry ? ` (${company.industry})` : ''}
${speaker.target_audiences?.length ? `- Target audiences: ${speaker.target_audiences.join(', ')}` : ''}
${speaker.talking_points?.length ? `- Talking points: ${speaker.talking_points.slice(0, 8).join(' | ')}` : ''}
${speaker.guest_identity_tags?.length ? `- Identity / positioning: ${speaker.guest_identity_tags.join(', ')}` : ''}
${speaker.campaign_strategy ? `- Strategy notes: ${String(speaker.campaign_strategy).slice(0, 800)}` : ''}
${speaker.avoid?.length ? `- AVOID topics: ${speaker.avoid.join(', ')}` : ''}

## Already booked or shortlisted (DO NOT suggest)
${[...excludeNames].slice(0, 60).join(', ') || 'None'}

## STRICT REQUIREMENTS
1. Must be **interview / conversation format** that regularly features outside guests. Reject solo shows, monologue shows, narrative/documentary, ad-read shows, and panel-only shows.
2. Must be a NICHE show in the **${listener_min}–${listener_max} listeners-per-episode** band. We do not want big mainstream shows.
3. Must be ACTIVELY publishing (episodes within last 6 months).
4. Must tightly fit the speaker's topic, audience, or industry — not generic business/leadership shows.
5. Hosted by a practitioner, consultant, or industry insider — NOT a celebrity.

## DO NOT SUGGEST
- Top 200 business/tech/leadership podcasts
- Any celebrity-hosted show (Tim Ferriss, Joe Rogan, Lex Fridman, Diary of a CEO, Lenny's, My First Million, Acquired, etc.)
- Major media-company shows (NPR, HBR, TED, WSJ, Bloomberg, Vox, NYT, Atlantic, etc.)
- Anything that looks like a top-100 chart resident

## EXAMPLES of the right shape
- "[Industry] Insiders Podcast" hosted by a working practitioner
- "The [Niche Vertical] Show" with consistent guest interviews
- Trade-association or professional-network shows
- B2B vertical podcasts with under 50K listeners
- Regional industry podcasts

For each podcast, return: podcast_name (exact, real, real-spelling), host_name, description (1–2 sentences on what it covers), why_it_fits (1 sentence on speaker-fit), target_audience, niche_tag (short label e.g. "Bootstrapped SaaS"), is_interview_format (must be true), est_listeners_range (micro=<2K, small=2K–15K, mid=15K–50K).

Return ${num} suggestions. Volume matters — generate a long list of valid niche options.`;

    console.log('[research-suggest-podcasts] Calling Gemini, prompt length:', prompt.length);

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a niche-podcast sourcing researcher who only surfaces real, currently-active small podcasts that book outside guests.' },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_suggestions',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      podcast_name: { type: 'string' },
                      host_name: { type: 'string' },
                      description: { type: 'string' },
                      why_it_fits: { type: 'string' },
                      target_audience: { type: 'string' },
                      niche_tag: { type: 'string' },
                      is_interview_format: { type: 'boolean' },
                      est_listeners_range: { type: 'string', enum: ['micro', 'small', 'mid'] },
                    },
                    required: ['podcast_name', 'description', 'why_it_fits', 'is_interview_format', 'est_listeners_range'],
                  },
                },
              },
              required: ['suggestions'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_suggestions' } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error('[research-suggest-podcasts] AI error:', aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, try again shortly' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error('Invalid AI response');
    const parsed = JSON.parse(toolCall.function.arguments);
    let raw: RawSuggestion[] = parsed.suggestions || [];

    // Drop non-interview shows and already-known shows
    raw = raw.filter(r =>
      r.is_interview_format &&
      !excludeNames.has(r.podcast_name.toLowerCase())
    );

    console.log(`[research-suggest-podcasts] ${raw.length} candidates after format/exclude filter`);

    // Hydrate via iTunes search (validates existence + gets cover art + apple URL)
    const hydrated: HydratedCandidate[] = [];

    for (const sug of raw) {
      const candidate: HydratedCandidate = {
        show_name: sug.podcast_name,
        host_name: sug.host_name,
        description: sug.description,
        guest_cadence_score: 0.8,
        guest_cadence_label: 'AI-vetted interview show',
        niche_fit_score: 0,
        fit_rationale: sug.why_it_fits,
        niche_tag: sug.niche_tag || sug.target_audience,
      };

      try {
        const q = encodeURIComponent(sug.podcast_name);
        const iTunesResp = await fetch(`https://itunes.apple.com/search?term=${q}&entity=podcast&limit=5`);
        if (iTunesResp.ok) {
          const data = await iTunesResp.json();
          const results: any[] = data.results || [];

          // Strict matching: require meaningful token overlap between the AI-suggested
          // name and the iTunes collectionName. Prevents hallucinated names from being
          // silently mapped to an unrelated real show (which would pollute the CRM).
          const STOPWORDS = new Set(['the','a','an','of','and','for','with','on','in','to','show','podcast','pod','episode']);
          const tokenize = (s: string): string[] =>
            String(s || '')
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ' ')
              .split(/\s+/)
              .filter(t => t.length > 2 && !STOPWORDS.has(t));

          const sugTokens = new Set(tokenize(sug.podcast_name));
          let bestMatch: any = null;
          let bestOverlap = 0;
          for (const r of results) {
            const candTokens = new Set(tokenize(r.collectionName));
            let overlap = 0;
            for (const t of sugTokens) if (candTokens.has(t)) overlap++;
            const minSize = Math.min(sugTokens.size, candTokens.size) || 1;
            const ratio = overlap / minSize;
            // Require at least 70% of the smaller token set to overlap AND at least 2 shared tokens
            // (or 1 shared token when AI name is a single significant word).
            const needed = sugTokens.size <= 1 ? 1 : 2;
            if (overlap >= needed && ratio >= 0.7 && overlap > bestOverlap) {
              bestOverlap = overlap;
              bestMatch = r;
            }
          }

          if (bestMatch) {
            // Use iTunes as the source of truth for show name + host to prevent
            // hallucinated AI names/hosts from reaching the CRM.
            candidate.show_name = bestMatch.collectionName || candidate.show_name;
            if (bestMatch.artistName) candidate.host_name = bestMatch.artistName;
            candidate.apple_podcast_url = bestMatch.collectionViewUrl;
            candidate.cover_art_url = bestMatch.artworkUrl600 || bestMatch.artworkUrl100;
            candidate.itunes_id = String(bestMatch.collectionId);
            candidate.categories = bestMatch.genres?.filter((g: string) => g !== 'Podcasts') || [];
            if (bestMatch.releaseDate) candidate.last_episode_date = bestMatch.releaseDate.split('T')[0];
          } else {
            candidate.dropped_reason = `No strict iTunes match for "${sug.podcast_name}"`;
            console.log(`[hydrate] DROPPED hallucinated name: "${sug.podcast_name}" — top iTunes result was "${results[0]?.collectionName || 'none'}"`);
          }
        }
      } catch (err) {
        console.warn('[hydrate] iTunes lookup failed for', sug.podcast_name, err);
      }

      // Drop if not validated on iTunes (likely hallucinated)
      if (!candidate.itunes_id) continue;

      // Drop if last episode > 6 months old
      if (candidate.last_episode_date) {
        const ageMs = Date.now() - new Date(candidate.last_episode_date).getTime();
        if (ageMs > 1000 * 60 * 60 * 24 * 180) {
          continue;
        }
      }

      hydrated.push(candidate);
    }

    console.log(`[research-suggest-podcasts] ${hydrated.length} after iTunes validation`);

    // Enrich a subset with Rephonic for listener counts (parallel, batched, capped)
    const namesForRephonic = hydrated.slice(0, 25).map(h => h.show_name);
    if (REPHONIC_API_KEY && namesForRephonic.length > 0) {
      try {
        const rResp = await fetch(`${SUPABASE_URL}/functions/v1/fetch-rephonic-metrics`, {
          method: 'POST',
          headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ podcast_names: namesForRephonic }),
        });
        if (rResp.ok) {
          const { results } = await rResp.json();
          for (const h of hydrated) {
            const m = results?.[h.show_name];
            if (m && !m.error && m.listeners_per_episode > 0) {
              h.est_listeners = m.listeners_per_episode;
            }
          }
        }
      } catch (err) {
        console.warn('[hydrate] Rephonic batch failed:', err);
      }
    }

    // Apply niche-fit scoring
    const audiences = (speaker.target_audiences || []).map((a: string) => a.toLowerCase());
    const talking = (speaker.talking_points || []).map((t: string) => t.toLowerCase());

    for (const h of hydrated) {
      const haystack = `${h.show_name} ${h.description} ${h.niche_tag || ''} ${(h.categories || []).join(' ')}`.toLowerCase();
      let topicHits = 0;
      audiences.forEach(a => { if (a && haystack.includes(a.split(' ')[0])) topicHits++; });
      talking.forEach(t => {
        const firstWord = t.split(' ')[0];
        if (firstWord && firstWord.length > 4 && haystack.includes(firstWord)) topicHits++;
      });

      const topicScore = Math.min(1, topicHits / Math.max(3, audiences.length + talking.length / 2));

      // Niche bonus: smaller is better within band; oversized = penalty
      let sizeScore = 0.5;
      if (h.est_listeners) {
        if (h.est_listeners < listener_min) sizeScore = 0.6;
        else if (h.est_listeners <= 5000) sizeScore = 1.0;
        else if (h.est_listeners <= 15000) sizeScore = 0.85;
        else if (h.est_listeners <= listener_max) sizeScore = 0.6;
        else sizeScore = 0.2; // above ceiling = penalized
      }

      h.niche_fit_score = Math.round((topicScore * 0.65 + sizeScore * 0.35) * 100);
    }

    // Sort: niche_fit_score desc, then prefer shows we have listener data for
    hydrated.sort((a, b) => {
      if (b.niche_fit_score !== a.niche_fit_score) return b.niche_fit_score - a.niche_fit_score;
      return (b.est_listeners ? 1 : 0) - (a.est_listeners ? 1 : 0);
    });

    return new Response(
      JSON.stringify({ success: true, candidates: hydrated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[research-suggest-podcasts] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
