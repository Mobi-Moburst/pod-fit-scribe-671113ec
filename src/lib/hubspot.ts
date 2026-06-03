import { supabase } from '@/integrations/supabase/client';

export type HubspotStage = { id: string; label: string; order: number };
export type HubspotPipeline = { id: string; label: string; stages: HubspotStage[] };
export type HubspotTicket = {
  id: string;
  subject: string;
  stage_id: string;
  owner_id: string | null;
  owner: { id: string; name: string; email: string } | null;
  priority: string | null;
  create_date: string | null;
  last_modified: string | null;
  close_date: string | null;
  show_url: string | null;
  kc_client: string | null;
};
export type HubspotStageGroup = { stage_id: string; label: string; order: number; tickets: HubspotTicket[] };

export type HubspotSettings = {
  org_id: string;
  portal_id: string | null;
  pipeline_id: string | null;
  pipeline_label: string | null;
  stages: HubspotStage[];
  kc_client_property: string;
  show_url_property: string | null;
  auto_create_associations: boolean;
  generic_domains: string[];
};

export type ResolvedEntity = {
  id: string | null;
  existing: boolean;
  properties: Record<string, any>;
  will_create?: Record<string, any>;
};

export type ResolvePreview = {
  ok: boolean;
  code?: string;
  error?: string;
  portal_id?: string | null;
  company?: ResolvedEntity;
  contact?: ResolvedEntity;
  duplicate_ticket_id?: string | null;
  suggested?: { domain: string | null; email: string | null };
};

export type Overrides = {
  host_first?: string;
  host_last?: string;
  host_email?: string;
  company_domain?: string;
  company_name?: string;
};

/** Discover pipelines + portal id (used in Settings to pick the right pipeline). */
export async function fetchHubspotPipelines(): Promise<{
  portal_id: string | null;
  pipelines: HubspotPipeline[];
}> {
  const { data, error } = await supabase.functions.invoke('hubspot-pipelines', { body: {} });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { portal_id: data.portal_id ?? null, pipelines: data.pipelines ?? [] };
}

/** Fetch tickets for a speaker (matched on the kc_client property). */
export async function fetchSpeakerTickets(speakerName: string): Promise<{
  ok: boolean;
  code?: 'not_connected' | 'not_configured';
  error?: string;
  portal_id?: string | null;
  pipeline_label?: string | null;
  total?: number;
  stages?: HubspotStageGroup[];
  tickets?: HubspotTicket[];
}> {
  const { data, error } = await supabase.functions.invoke('hubspot-tickets', {
    body: { speaker_name: speakerName },
  });
  if (error) {
    const code = (data as any)?.code;
    return { ok: false, code, error: (data as any)?.error || error.message };
  }
  if (data?.error) return { ok: false, code: data.code, error: data.error };
  return {
    ok: true,
    portal_id: data.portal_id,
    pipeline_label: data.pipeline_label,
    total: data.total,
    stages: data.stages,
    tickets: data.tickets,
  };
}

/** Dry-run resolve: returns what Company/Contact would be matched or created, plus duplicate ticket. */
export async function resolveHubspotAssociations(
  shortlistId: string,
  overrides: Overrides = {},
): Promise<ResolvePreview> {
  const { data, error } = await supabase.functions.invoke('hubspot-resolve-associations', {
    body: { shortlist_id: shortlistId, overrides },
  });
  if (error) return { ok: false, code: (data as any)?.code, error: (data as any)?.error || error.message };
  if (data?.error) return { ok: false, code: data.code, error: data.error };
  return {
    ok: true,
    portal_id: data.portal_id,
    company: data.company,
    contact: data.contact,
    duplicate_ticket_id: data.duplicate_ticket_id,
  };
}

/** Send a shortlist row to HubSpot as a new ticket in stage 1 of the chosen pipeline. */
export async function createTicketFromShortlist(
  shortlistId: string,
  overrides: Overrides = {},
): Promise<{
  ok: boolean;
  ticket_id?: string;
  contact_id?: string | null;
  company_id?: string | null;
  portal_id?: string | null;
  deduped?: boolean;
  created?: { company: boolean; contact: boolean };
  error?: string;
  code?: string;
}> {
  const { data, error } = await supabase.functions.invoke('hubspot-create-ticket', {
    body: { shortlist_id: shortlistId, overrides },
  });
  if (error) return { ok: false, code: (data as any)?.code, error: (data as any)?.error || error.message };
  if (data?.error) return { ok: false, code: data.code, error: data.error };
  return {
    ok: true,
    ticket_id: data.ticket_id,
    contact_id: data.contact_id,
    company_id: data.company_id,
    portal_id: data.portal_id,
    deduped: data.deduped,
    created: data.created,
  };
}

/** Normalize a podcast/ticket name for dedupe comparisons. */
export function normalizeShowName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/\s+podcast$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function hubspotTicketUrl(portalId: string | null | undefined, ticketId: string): string {
  if (!portalId) return '#';
  return `https://app.hubspot.com/contacts/${portalId}/ticket/${ticketId}`;
}
