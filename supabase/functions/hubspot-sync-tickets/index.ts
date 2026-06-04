// Sync HubSpot tickets (current year) into hubspot_tickets_cache.
// Modes: "full" (refetch all current-year tickets + delete stale) or
//        "incremental" (only tickets modified since max(last_modified)).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createLogger, loggedHubspotFetch, newRequestId } from "../_shared/hubspot-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/hubspot';
const TEAM_ORG_ID = '11111111-1111-1111-1111-111111111111';

function shapeRow(orgId: string, t: any, owners: Record<string, any>, showUrlProp: string | null) {
  const p = t.properties || {};
  const ownerId = p.hubspot_owner_id || null;
  const owner = ownerId ? owners[ownerId] : null;
  return {
    org_id: orgId,
    hubspot_ticket_id: String(t.id),
    pipeline_id: p.hs_pipeline || null,
    stage_id: p.hs_pipeline_stage || null,
    subject: p.subject || null,
    kc_client: p.kc_client || null,
    kc_shortlist_id: p.kc_shortlist_id || null,
    hubspot_owner_id: ownerId,
    owner_name: owner?.name || null,
    owner_email: owner?.email || null,
    priority: p.hs_ticket_priority || null,
    show_url: showUrlProp ? (p[showUrlProp] || null) : null,
    createdate: p.createdate || null,
    last_modified: p.hs_lastmodifieddate || null,
    close_date: p.closedate || null,
    raw_properties: p,
    synced_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  const requestId = newRequestId();
  const logger = createLogger({ fn: 'hubspot-sync-tickets', requestId, orgId: TEAM_ORG_ID });
  logger.info('request_received', { method: req.method });


  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!HUBSPOT_API_KEY) throw new Error('HUBSPOT_API_KEY not configured');

    const body = await req.json().catch(() => ({}));
    const mode: 'full' | 'incremental' | 'backfill' =
      body.mode === 'full' ? 'full' : body.mode === 'backfill' ? 'backfill' : 'incremental';
    logger.info('mode_resolved', { mode });


    // Backfill params (used only when mode === 'backfill')
    const DEFAULT_BACKFILL_STAGES = ['1366108009', '1366108010', '1366108011'];
    const backfillStageIds: string[] = Array.isArray(body.stage_ids) && body.stage_ids.length
      ? body.stage_ids.map((s: any) => String(s))
      : DEFAULT_BACKFILL_STAGES;
    const monthsBack: number = Number.isFinite(body.months_back) ? Number(body.months_back) : 24;
    const backfillClientNamesInput: string[] | null = Array.isArray(body.client_names)
      ? body.client_names.map((s: any) => String(s)).filter(Boolean)
      : null;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: settings } = await supabase
      .from('hubspot_settings').select('*').eq('org_id', TEAM_ORG_ID).maybeSingle();
    if (!settings || !settings.pipeline_id) {
      return new Response(JSON.stringify({ error: 'HubSpot pipeline not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const pipelineId = settings.pipeline_id as string;
    const showUrlProp = (settings.show_url_property as string | null) || null;

    const headers = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': HUBSPOT_API_KEY,
      'Content-Type': 'application/json',
    };

    // Discover which ticket properties actually exist in this portal so a
    // missing custom property (kc_client, kc_shortlist_id, show_url, etc.)
    // doesn't 400 the entire search.
    const wantProps = [
      'subject', 'hs_pipeline', 'hs_pipeline_stage',
      'hubspot_owner_id', 'hs_ticket_priority',
      'createdate', 'hs_lastmodifieddate', 'closedate',
      'kc_client', 'kc_shortlist_id',
    ];
    if (showUrlProp) wantProps.push(showUrlProp);

    let availableProps = new Set<string>(wantProps);
    try {
      const pr = await loggedHubspotFetch(logger, `${GATEWAY_URL}/crm/v3/properties/tickets`, { headers }, { phase: 'property_discovery' });
      if (pr.ok) {
        const pj = await pr.json();
        const names = new Set<string>((pj.results || []).map((p: any) => p.name));
        availableProps = new Set(wantProps.filter((p) => names.has(p)));
        const missing = wantProps.filter((p) => !names.has(p));
        if (missing.length) logger.warn('property_discovery_missing', { missing });
      }
    } catch (e) {
      logger.warn('property_discovery_failed', { message: e instanceof Error ? e.message : String(e) });
    }
    const properties = Array.from(availableProps);


    // Build filter
    const yearStart = new Date(new Date().getUTCFullYear(), 0, 1).getTime();
    let sinceTs: number = yearStart;
    if (mode === 'incremental') {
      const { data: maxRow } = await supabase
        .from('hubspot_tickets_cache')
        .select('last_modified')
        .eq('org_id', TEAM_ORG_ID)
        .order('last_modified', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (maxRow?.last_modified) {
        sinceTs = new Date(maxRow.last_modified as string).getTime();
      }
    }

    // Reusable paginated search with 10k after-cap handling.
    // `extraFilters` is appended to every page's filters[] (AND).
    async function runSearch(opts: {
      createdateGte: number;
      lastModifiedGte: number;
      extraFilters?: Array<{ propertyName: string; operator: string; value?: string; values?: string[] }>;
      label: string;
    }) {
      const collected: any[] = [];
      let cursorTs = opts.lastModifiedGte;
      let after: string | undefined;
      let pages = 0;
      let pageInWindow = 0;
      while (pages < 500) {
        const filters: any[] = [
          { propertyName: 'hs_pipeline', operator: 'EQ', value: pipelineId },
          { propertyName: 'createdate', operator: 'GTE', value: String(opts.createdateGte) },
          { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: String(cursorTs) },
          ...(opts.extraFilters || []),
        ];
        const resp = await loggedHubspotFetch(logger, `${GATEWAY_URL}/crm/v3/objects/tickets/search`, {
          method: 'POST', headers,
          body: JSON.stringify({
            filterGroups: [{ filters }],
            properties,
            sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
            limit: 100,
            after,
          }),
        }, { phase: 'ticket_search', label: opts.label, page: pages });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(`HubSpot search ${resp.status} (${opts.label} page ${pages}, after=${after}, cursorTs=${cursorTs}): ${t.slice(0, 400)}`);
        }
        const json = await resp.json();
        const results: any[] = json.results || [];
        collected.push(...results);
        pages++;
        pageInWindow++;
        after = json.paging?.next?.after;
        if (after && pageInWindow >= 95 && results.length > 0) {
          const lastTs = Number(results[results.length - 1].properties?.hs_lastmodifieddate);
          if (Number.isFinite(lastTs) && lastTs > cursorTs) {
            cursorTs = lastTs;
            after = undefined;
            pageInWindow = 0;
            continue;
          }
        }
        if (!after) break;
      }
      return { results: collected, pages };
    }

    const all: any[] = [];
    const seenIds = new Set<string>();
    let pages = 0;

    if (mode === 'backfill') {
      // Resolve client names: explicit list or active speakers from DB
      let clientNames = backfillClientNamesInput;
      if (!clientNames) {
        const { data: speakers } = await supabase
          .from('speakers')
          .select('name')
          .is('archived_at', null);
        clientNames = Array.from(new Set((speakers || []).map((s: any) => String(s.name)).filter(Boolean)));
      }
      const createdateGte = Date.now() - monthsBack * 30 * 24 * 60 * 60 * 1000;
      // Chunk clients to keep IN-clause manageable
      const CHUNK = 25;
      const clientChunks: string[][] = [];
      for (let i = 0; i < clientNames.length; i += CHUNK) {
        clientChunks.push(clientNames.slice(i, i + CHUNK));
      }
      console.log(`[hubspot-sync-tickets] backfill: ${backfillStageIds.length} stages × ${clientChunks.length} client-chunks (${clientNames.length} speakers), monthsBack=${monthsBack}`);

      for (const stageId of backfillStageIds) {
        for (const chunk of clientChunks) {
          const label = `stage=${stageId} clients=${chunk.length}`;
          const { results, pages: p } = await runSearch({
            createdateGte,
            lastModifiedGte: 0,
            extraFilters: [
              { propertyName: 'hs_pipeline_stage', operator: 'EQ', value: stageId },
              { propertyName: 'kc_client', operator: 'IN', values: chunk },
            ],
            label,
          });
          pages += p;
          for (const r of results) {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              all.push(r);
            }
          }
        }
      }
    } else {
      const { results, pages: p } = await runSearch({
        createdateGte: yearStart,
        lastModifiedGte: sinceTs,
        label: mode,
      });
      pages = p;
      for (const r of results) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          all.push(r);
        }
      }
    }



    // Resolve owners (one fetch per unique id)
    const ownerIds = Array.from(new Set(all.map((t) => t.properties?.hubspot_owner_id).filter(Boolean)));
    const owners: Record<string, { id: string; name: string; email: string }> = {};
    await Promise.all(ownerIds.map(async (id) => {
      try {
        const r = await fetch(`${GATEWAY_URL}/crm/v3/owners/${id}`, { headers });
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

    // Upsert in chunks
    const rows = all.map((t) => shapeRow(TEAM_ORG_ID, t, owners, showUrlProp));
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from('hubspot_tickets_cache')
        .upsert(chunk, { onConflict: 'org_id,hubspot_ticket_id' });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
      upserted += chunk.length;
    }

    // Stale-delete only in full mode
    let deleted = 0;
    if (mode === 'full') {
      const liveIds = new Set(rows.map((r) => r.hubspot_ticket_id));
      const yearStartIso = new Date(yearStart).toISOString();
      const { data: existing } = await supabase
        .from('hubspot_tickets_cache')
        .select('hubspot_ticket_id')
        .eq('org_id', TEAM_ORG_ID)
        .gte('createdate', yearStartIso);
      const toDelete = (existing || [])
        .map((r: any) => r.hubspot_ticket_id)
        .filter((id: string) => !liveIds.has(id));
      for (let i = 0; i < toDelete.length; i += 500) {
        const chunk = toDelete.slice(i, i + 500);
        const { error } = await supabase
          .from('hubspot_tickets_cache')
          .delete()
          .eq('org_id', TEAM_ORG_ID)
          .in('hubspot_ticket_id', chunk);
        if (error) throw new Error(`Delete failed: ${error.message}`);
        deleted += chunk.length;
      }
    }

    return new Response(JSON.stringify({
      success: true, mode, synced: upserted, deleted,
      pages, duration_ms: Date.now() - started,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[hubspot-sync-tickets]', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown',
      duration_ms: Date.now() - started,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
