// Fetch HubSpot tickets for a specific speaker (matched by the kc_client property)
// within the configured "Agent Master Pipeline". Returns tickets grouped by stage.
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
    const speaker_name: string | undefined = body.speaker_name?.trim();
    if (!speaker_name) {
      return new Response(JSON.stringify({ error: 'speaker_name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load configured pipeline + property names
    const { data: settings } = await supabase
      .from('hubspot_settings')
      .select('*')
      .maybeSingle();

    if (!settings || !settings.pipeline_id) {
      return new Response(
        JSON.stringify({ error: 'HubSpot pipeline not configured', code: 'not_configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pipelineId = settings.pipeline_id as string;
    const stages = (settings.stages as Array<{ id: string; label: string; order: number }>) || [];
    const kcProp = (settings.kc_client_property as string) || 'kc_client';
    const showUrlProp = settings.show_url_property as string | null;

    const properties = [
      'subject', 'content', 'hs_pipeline', 'hs_pipeline_stage',
      'hubspot_owner_id', 'hs_ticket_priority',
      'createdate', 'hs_lastmodifieddate', 'closedate',
      kcProp,
    ];
    if (showUrlProp) properties.push(showUrlProp);

    const hubspotHeaders = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': HUBSPOT_API_KEY,
      'Content-Type': 'application/json',
    };

    // Paginate through search results
    const all: any[] = [];
    let after: string | undefined = undefined;
    for (let i = 0; i < 5; i++) {
      const resp = await fetch(`${GATEWAY_URL}/crm/v3/objects/tickets/search`, {
        method: 'POST',
        headers: hubspotHeaders,
        body: JSON.stringify({
          filterGroups: [{
            filters: [
              { propertyName: kcProp, operator: 'EQ', value: speaker_name },
              { propertyName: 'hs_pipeline', operator: 'EQ', value: pipelineId },
            ],
          }],
          properties,
          sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
          limit: 100,
          after,
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error('[hubspot-tickets] search error', resp.status, t);
        throw new Error(`HubSpot search error ${resp.status}: ${t.slice(0, 300)}`);
      }
      const json = await resp.json();
      all.push(...(json.results || []));
      after = json.paging?.next?.after;
      if (!after) break;
    }

    // Resolve owner names for any unique ownerIds
    const ownerIds = Array.from(new Set(all.map((t) => t.properties?.hubspot_owner_id).filter(Boolean)));
    const owners: Record<string, { id: string; name: string; email: string }> = {};
    await Promise.all(ownerIds.map(async (id) => {
      try {
        const r = await fetch(`${GATEWAY_URL}/crm/v3/owners/${id}`, { headers: hubspotHeaders });
        if (r.ok) {
          const o = await r.json();
          owners[id as string] = {
            id: o.id,
            name: [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || 'Owner',
            email: o.email || '',
          };
        }
      } catch (_) { /* ignore */ }
    }));

    // Shape tickets
    const tickets = all.map((t) => {
      const p = t.properties || {};
      return {
        id: t.id,
        subject: p.subject || '(no subject)',
        stage_id: p.hs_pipeline_stage,
        owner_id: p.hubspot_owner_id || null,
        owner: p.hubspot_owner_id ? owners[p.hubspot_owner_id] || null : null,
        priority: p.hs_ticket_priority || null,
        create_date: p.createdate || null,
        last_modified: p.hs_lastmodifieddate || null,
        close_date: p.closedate || null,
        show_url: showUrlProp ? (p[showUrlProp] || null) : null,
        kc_client: p[kcProp] || null,
      };
    });

    // Group by stage in configured order
    const grouped = stages.map((s) => ({
      stage_id: s.id,
      label: s.label,
      order: s.order,
      tickets: tickets.filter((t) => t.stage_id === s.id),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        portal_id: settings.portal_id || null,
        pipeline_id: pipelineId,
        pipeline_label: settings.pipeline_label || null,
        total: tickets.length,
        stages: grouped,
        tickets,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[hubspot-tickets] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
