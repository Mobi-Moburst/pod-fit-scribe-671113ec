// Infer the `industry` field on momentum_bookings rows that are currently
// missing/Unknown. Strategy:
//   1. Group unknown bookings by client_name.
//   2. For clients whose company is already labeled, copy that label.
//   3. For the rest, ask Lovable AI (Gemini 3 Flash) to classify the client
//      using their booked podcast names, choosing from a fixed taxonomy.
//   4. Update every matching momentum_bookings row by client_name.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const TAXONOMY = [
  'AI Productivity', 'Consulting', 'Consumer', 'Cybersecurity', 'Data & AI',
  'DevTools', 'E-commerce', 'EdTech', 'Education', 'Enterprise AI',
  'Fintech', 'Healthcare', 'HealthTech', 'HR & People', 'Legal',
  'Marketing & Growth', 'Real Estate', 'SaaS', 'Media & Entertainment',
  'Manufacturing', 'Energy', 'Non-profit', 'Government', 'Sports & Fitness',
  'Food & Beverage', 'Travel & Hospitality', 'Other',
];

const BATCH_SIZE = 25;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Pull all unknown bookings.
    const { data: rows, error } = await supabase
      .from('momentum_bookings')
      .select('id, client_name, podcast_name, company_id, industry')
      .or('industry.is.null,industry.eq.,industry.eq.Unknown')
      .not('client_name', 'is', null)
      .limit(5000);
    if (error) throw error;

    type Client = { client_name: string; company_id: string | null; podcasts: Set<string> };
    const byClient = new Map<string, Client>();
    for (const r of rows ?? []) {
      const name = r.client_name as string;
      if (!byClient.has(name)) {
        byClient.set(name, { client_name: name, company_id: r.company_id, podcasts: new Set() });
      }
      if (r.podcast_name) byClient.get(name)!.podcasts.add(r.podcast_name);
      if (r.company_id && !byClient.get(name)!.company_id) byClient.get(name)!.company_id = r.company_id;
    }

    // 2. Copy from companies.industry where available.
    const companyIds = Array.from(new Set(
      Array.from(byClient.values()).map((c) => c.company_id).filter(Boolean) as string[]
    ));
    const companyIndustry = new Map<string, string>();
    if (companyIds.length) {
      const { data: comps } = await supabase
        .from('companies')
        .select('id, industry')
        .in('id', companyIds);
      for (const c of comps ?? []) {
        if (c.industry && c.industry !== 'Unknown') companyIndustry.set(c.id, c.industry);
      }
    }

    const resolved = new Map<string, string>(); // client_name -> industry
    const needsAI: Client[] = [];
    for (const c of byClient.values()) {
      if (c.company_id && companyIndustry.has(c.company_id)) {
        resolved.set(c.client_name, companyIndustry.get(c.company_id)!);
      } else {
        needsAI.push(c);
      }
    }

    // 3. Batch the rest through Lovable AI.
    let aiCalls = 0;
    for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
      const chunk = needsAI.slice(i, i + BATCH_SIZE);
      const payload = chunk.map((c) => ({
        client: c.client_name,
        sample_podcasts: Array.from(c.podcasts).slice(0, 5),
      }));
      const system = `You classify business executives / podcast guests into an industry. Choose ONE label per client from this exact list: ${TAXONOMY.join(', ')}. Use the booked podcast names as evidence of the client's professional focus. If genuinely unclear, use "Other".`;
      const user = `Return ONLY a JSON array of {"client": string, "industry": string} objects, one per input. Inputs:\n${JSON.stringify(payload)}`;

      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      aiCalls++;
      if (!resp.ok) {
        const body = await resp.text();
        console.error('AI gateway error', resp.status, body);
        if (resp.status === 429 || resp.status === 402) {
          return new Response(JSON.stringify({ error: 'AI rate limit or credits exhausted', status: resp.status }), {
            status: resp.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        continue;
      }
      const json = await resp.json();
      const content = json?.choices?.[0]?.message?.content ?? '';
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error('Failed to parse AI JSON', content);
        continue;
      }
      const list: any[] = Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.data ?? parsed.clients ?? []);
      for (const item of list) {
        if (item?.client && item?.industry && TAXONOMY.includes(item.industry)) {
          resolved.set(item.client, item.industry);
        }
      }
    }

    // 4. Write back. One UPDATE per industry/client combo to keep it simple.
    let updatedRows = 0;
    for (const [client, industry] of resolved.entries()) {
      const { error: updErr, count } = await supabase
        .from('momentum_bookings')
        .update({ industry })
        .eq('client_name', client)
        .or('industry.is.null,industry.eq.,industry.eq.Unknown')
        .select('id', { count: 'exact', head: true });
      if (updErr) {
        console.error('Update failed for', client, updErr.message);
        continue;
      }
      updatedRows += count ?? 0;
    }

    return new Response(
      JSON.stringify({
        clients_total: byClient.size,
        clients_from_companies: byClient.size - needsAI.length,
        clients_classified_by_ai: resolved.size - (byClient.size - needsAI.length),
        ai_batches: aiCalls,
        bookings_updated: updatedRows,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
