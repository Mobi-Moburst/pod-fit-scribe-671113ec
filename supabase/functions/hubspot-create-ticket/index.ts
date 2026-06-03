// Create a HubSpot ticket from a shortlisted podcast row, with auto-created
// Company (the show) and Contact (the host), and associate them all.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveAssociations, associate, type Overrides } from "../_shared/hubspot-resolve.ts";

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

    const stages = (settings.stages as Array<{ id: string; label: string; order: number }>) || [];
    const firstStage = stages.slice().sort((a, b) => a.order - b.order)[0];
    if (!firstStage) throw new Error('No stages found in configured pipeline');

    const kcProp = (settings.kc_client_property as string) || 'kc_client';
    const showUrlProp = settings.show_url_property as string | null;
    const autoCreate = settings.auto_create_associations !== false;

    // Resolve + create company/contact (skip create if user disabled auto-create)
    const resolved = await resolveAssociations({
      row, speaker, settings, overrides,
      LOVABLE_API_KEY, HUBSPOT_API_KEY,
      dryRun: !autoCreate,
      callerEmail: (claims.claims as any)?.email || null,
      supabase,
    });

    // Short-circuit on duplicate ticket
    if (resolved.duplicate_ticket_id) {
      await supabase.from('research_shortlists').update({
        status: 'sent-to-hubspot',
        hubspot_ticket_id: resolved.duplicate_ticket_id,
        hubspot_contact_id: resolved.contact.id,
        hubspot_company_id: resolved.company.id,
        hubspot_synced_at: new Date().toISOString(),
      }).eq('id', shortlist_id);
      return new Response(
        JSON.stringify({
          success: true,
          deduped: true,
          ticket_id: resolved.duplicate_ticket_id,
          contact_id: resolved.contact.id,
          company_id: resolved.company.id,
          portal_id: settings.portal_id || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build + create the ticket
    const properties: Record<string, string> = {
      subject: row.show_name,
      hs_pipeline: settings.pipeline_id,
      hs_pipeline_stage: firstStage.id,
      [kcProp]: speaker.name,
      kc_shortlist_id: row.id,
      kc_source: 'command_center',
    };
    if (showUrlProp && row.show_url) properties[showUrlProp] = row.show_url;
    const noteParts: string[] = [];
    if (row.show_url) noteParts.push(`Show URL: ${row.show_url}`);
    if (row.host_name) noteParts.push(`Host: ${row.host_name}`);
    if (row.description) noteParts.push(row.description);
    noteParts.push('Sent from Kitcaster Command Center');
    properties.content = noteParts.join('\n\n');

    const hubspotHeaders = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': HUBSPOT_API_KEY,
      'Content-Type': 'application/json',
    };

    const resp = await fetch(`${GATEWAY_URL}/crm/v3/objects/tickets`, {
      method: 'POST', headers: hubspotHeaders, body: JSON.stringify({ properties }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error('[hubspot-create-ticket] error', resp.status, t);
      return new Response(
        JSON.stringify({ error: `HubSpot create ticket failed (${resp.status}): ${t.slice(0, 400)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const created = await resp.json();
    const ticketId: string = created.id;

    // Associate
    if (resolved.company.id) {
      await associate('tickets', ticketId, 'companies', resolved.company.id, LOVABLE_API_KEY, HUBSPOT_API_KEY);
    }
    if (resolved.contact.id) {
      await associate('tickets', ticketId, 'contacts', resolved.contact.id, LOVABLE_API_KEY, HUBSPOT_API_KEY);
      if (resolved.company.id) {
        await associate('contacts', resolved.contact.id, 'companies', resolved.company.id, LOVABLE_API_KEY, HUBSPOT_API_KEY);
      }
    }

    await supabase.from('research_shortlists').update({
      status: 'sent-to-hubspot',
      hubspot_ticket_id: ticketId,
      hubspot_contact_id: resolved.contact.id,
      hubspot_company_id: resolved.company.id,
      hubspot_synced_at: new Date().toISOString(),
    }).eq('id', shortlist_id);

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticketId,
        contact_id: resolved.contact.id,
        company_id: resolved.company.id,
        portal_id: settings.portal_id || null,
        created: {
          company: !resolved.company.existing,
          contact: !resolved.contact.existing,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[hubspot-create-ticket] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
