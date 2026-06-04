// Fetch HubSpot tickets for a specific speaker from the local cache
// (hubspot_tickets_cache). Falls back to triggering a full sync if the cache
// is empty.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createLogger, newRequestId } from "../_shared/hubspot-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEAM_ORG_ID = '11111111-1111-1111-1111-111111111111';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  const requestId = newRequestId();
  const logger = createLogger({ fn: 'hubspot-tickets', requestId, orgId: TEAM_ORG_ID });
  logger.info('request_received', { method: req.method });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
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
    const speaker_name: string | undefined = body.speaker_name?.trim();
    if (!speaker_name) {
      return new Response(JSON.stringify({ error: 'speaker_name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await supabase
      .from('hubspot_settings').select('*').maybeSingle();
    if (!settings || !settings.pipeline_id) {
      return new Response(
        JSON.stringify({ error: 'HubSpot pipeline not configured', code: 'not_configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pipelineId = settings.pipeline_id as string;
    const stages = (settings.stages as Array<{ id: string; label: string; order: number }>) || [];

    // If cache is empty, trigger an inline full sync once.
    const { count } = await supabase
      .from('hubspot_tickets_cache')
      .select('hubspot_ticket_id', { count: 'exact', head: true })
      .eq('org_id', TEAM_ORG_ID);
    if (!count || count === 0) {
      logger.info('cache_empty_triggering_sync');
      try {
        await supabase.functions.invoke('hubspot-sync-tickets', { body: { mode: 'full' } });
      } catch (e) {
        logger.warn('inline_sync_failed', { message: e instanceof Error ? e.message : String(e) });
      }
    }

    const { data: rows, error: qErr } = await supabase
      .from('hubspot_tickets_cache')
      .select('*')
      .eq('org_id', TEAM_ORG_ID)
      .eq('pipeline_id', pipelineId)
      .eq('kc_client', speaker_name)
      .order('last_modified', { ascending: false, nullsFirst: false });
    if (qErr) throw new Error(`Cache query failed: ${qErr.message}`);

    const tickets = (rows || []).map((r: any) => ({
      id: r.hubspot_ticket_id,
      subject: r.subject || '(no subject)',
      stage_id: r.stage_id,
      owner_id: r.hubspot_owner_id || null,
      owner: r.hubspot_owner_id
        ? { id: r.hubspot_owner_id, name: r.owner_name || 'Owner', email: r.owner_email || '' }
        : null,
      priority: r.priority || null,
      create_date: r.createdate || null,
      last_modified: r.last_modified || null,
      close_date: r.close_date || null,
      show_url: r.show_url || null,
      kc_client: r.kc_client || null,
    }));

    const grouped = stages.map((s) => ({
      stage_id: s.id,
      label: s.label,
      order: s.order,
      tickets: tickets.filter((t) => t.stage_id === s.id),
    }));

    return new Response(JSON.stringify({
      success: true,
      portal_id: settings.portal_id || null,
      pipeline_id: pipelineId,
      pipeline_label: settings.pipeline_label || null,
      total: tickets.length,
      stages: grouped,
      tickets,
      source: 'cache',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[hubspot-tickets] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
