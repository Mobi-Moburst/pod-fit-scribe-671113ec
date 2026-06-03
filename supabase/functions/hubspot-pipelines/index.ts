// Fetch HubSpot ticket pipelines + portal id, so the user can pick the right one
// in Settings and we cache pipeline_id / stages / portal_id in hubspot_settings.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/hubspot';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!HUBSPOT_API_KEY) throw new Error('HUBSPOT_API_KEY not configured — connect HubSpot first');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hubspotHeaders = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': HUBSPOT_API_KEY,
      'Content-Type': 'application/json',
    };

    const [pipelinesResp, accountResp] = await Promise.all([
      fetch(`${GATEWAY_URL}/crm/v3/pipelines/tickets`, { headers: hubspotHeaders }),
      fetch(`${GATEWAY_URL}/account-info/v3/details`, { headers: hubspotHeaders }),
    ]);

    if (!pipelinesResp.ok) {
      const t = await pipelinesResp.text();
      throw new Error(`HubSpot pipelines error ${pipelinesResp.status}: ${t}`);
    }
    const pipelinesJson = await pipelinesResp.json();
    const accountJson = accountResp.ok ? await accountResp.json() : {};

    const pipelines = (pipelinesJson.results || []).map((p: any) => ({
      id: p.id,
      label: p.label,
      stages: (p.stages || [])
        .slice()
        .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((s: any) => ({ id: s.id, label: s.label, order: s.displayOrder ?? 0 })),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        portal_id: accountJson.portalId ? String(accountJson.portalId) : null,
        pipelines,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[hubspot-pipelines] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
