// Dry-run resolve of HubSpot Company + Contact + duplicate Ticket for a shortlist row.
// Reads only — does not create anything.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveAssociations, type Overrides } from "../_shared/hubspot-resolve.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!HUBSPOT_API_KEY) {
      return new Response(JSON.stringify({ error: 'HubSpot is not connected', code: 'not_connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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

    const body = await req.json().catch(() => ({}));
    const shortlist_id: string | undefined = body.shortlist_id;
    const overrides: Overrides = body.overrides || {};
    if (!shortlist_id) {
      return new Response(JSON.stringify({ error: 'shortlist_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: row, error: rErr } = await supabase
      .from('research_shortlists').select('*').eq('id', shortlist_id).single();
    if (rErr || !row) throw new Error(`Shortlist row not found: ${rErr?.message}`);

    const { data: speaker, error: sErr } = await supabase
      .from('speakers').select('id, name').eq('id', row.speaker_id).single();
    if (sErr || !speaker) throw new Error(`Speaker not found: ${sErr?.message}`);

    const { data: settings } = await supabase
      .from('hubspot_settings').select('*').maybeSingle();
    if (!settings || !settings.pipeline_id) {
      return new Response(
        JSON.stringify({ error: 'HubSpot pipeline not configured', code: 'not_configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const preview = await resolveAssociations({
      row, speaker, settings, overrides,
      LOVABLE_API_KEY, HUBSPOT_API_KEY, dryRun: true,
      callerEmail: (claims.claims as any)?.email || null,
      supabase,
    });

    return new Response(
      JSON.stringify({ success: true, portal_id: settings.portal_id || null, ...preview }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[hubspot-resolve-associations] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
