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
export type HubspotStageGroup = HubspotStage & { tickets: HubspotTicket[] };

export type HubspotSettings = {
  org_id: string;
  portal_id: string | null;
  pipeline_id: string | null;
  pipeline_label: string | null;
  stages: HubspotStage[];
  kc_client_property: string;
  show_url_property: string | null;
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
    // Edge errors come back as non-2xx with the body in `data` on supabase-js v2
    const code = (data as any)?.code;
    return { ok: false, code, error: (data as any)?.error || error.message };
  }
  if (data?.error) {
    return { ok: false, code: data.code, error: data.error };
  }
  return {
    ok: true,
    portal_id: data.portal_id,
    pipeline_label: data.pipeline_label,
    total: data.total,
    stages: data.stages,
    tickets: data.tickets,
  };
}

/** Send a shortlist row to HubSpot as a new ticket in stage 1 of the chosen pipeline. */
export async function createTicketFromShortlist(shortlistId: string): Promise<{
  ok: boolean;
  ticket_id?: string;
  portal_id?: string | null;
  error?: string;
  code?: string;
}> {
  const { data, error } = await supabase.functions.invoke('hubspot-create-ticket', {
    body: { shortlist_id: shortlistId },
  });
  if (error) {
    return { ok: false, code: (data as any)?.code, error: (data as any)?.error || error.message };
  }
  if (data?.error) return { ok: false, code: data.code, error: data.error };
  return { ok: true, ticket_id: data.ticket_id, portal_id: data.portal_id };
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
