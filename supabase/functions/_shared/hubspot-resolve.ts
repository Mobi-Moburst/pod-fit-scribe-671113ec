// Shared HubSpot resolve/create/associate logic for shortlist → ticket flow.
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/hubspot';

export type Overrides = {
  host_first?: string;
  host_last?: string;
  host_email?: string;
  company_domain?: string;
  company_name?: string;
};

export type ResolveInput = {
  row: any;
  speaker: { id: string; name: string };
  settings: any;
  overrides: Overrides;
  LOVABLE_API_KEY: string;
  HUBSPOT_API_KEY: string;
  dryRun: boolean;
  callerEmail?: string | null;
  supabase?: any; // SupabaseClient — used to invoke fetch-rephonic-metrics for show notes
};

export type ResolvedEntity = {
  id: string | null;
  existing: boolean;
  properties: Record<string, any>;
  will_create?: Record<string, any>;
};

export type ResolveResult = {
  company: ResolvedEntity;
  contact: ResolvedEntity;
  duplicate_ticket_id: string | null;
  suggested: {
    domain: string | null;
    email: string | null;
  };
};

const GENERIC_FALLBACK = ['apple.com', 'podcasts.apple.com', 'spotify.com', 'youtube.com', 'substack.com'];

function hubspotHeaders(LOVABLE_API_KEY: string, HUBSPOT_API_KEY: string) {
  return {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': HUBSPOT_API_KEY,
    'Content-Type': 'application/json',
  };
}

export function parseDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

export function splitHostName(name: string | null | undefined): { first: string; last: string } {
  if (!name) return { first: '', last: '' };
  const cleaned = name.trim().replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '');
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

async function searchObject(
  type: 'companies' | 'contacts' | 'tickets',
  body: any,
  headers: Record<string, string>,
): Promise<any[]> {
  const resp = await fetch(`${GATEWAY_URL}/crm/v3/objects/${type}/search`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error(`[hubspot-resolve] ${type} search ${resp.status}`, t);
    return [];
  }
  const j = await resp.json();
  return j.results || [];
}

async function resolveOwnerIdByEmail(
  email: string | null | undefined,
  headers: Record<string, string>,
): Promise<string | null> {
  if (!email) return null;
  try {
    const resp = await fetch(
      `${GATEWAY_URL}/crm/v3/owners?email=${encodeURIComponent(email)}&limit=1`,
      { method: 'GET', headers },
    );
    if (!resp.ok) {
      console.warn(`[hubspot-resolve] owner lookup ${resp.status} for ${email}`);
      return null;
    }
    const j = await resp.json();
    return j?.results?.[0]?.id || null;
  } catch (err) {
    console.warn('[hubspot-resolve] owner lookup error:', err);
    return null;
  }
}

async function fetchRephonicShowData(
  supabase: any,
  showUrl: string | null,
  showName: string | null,
): Promise<{ description: string | null; listen_url: string | null; email: string | null; web_url: string | null; rephonic_url: string | null }> {
  const empty = { description: null, listen_url: null, email: null, web_url: null, rephonic_url: null };
  if (!supabase) return empty;
  if (!showUrl && !showName) return empty;
  try {
    const body: any = {};
    if (showUrl && /apple\.com|podcasts\.apple\.com/i.test(showUrl)) {
      body.apple_podcast_urls = [showUrl];
    } else if (showName) {
      body.podcast_names = [showName];
    } else {
      return empty;
    }
    const { data, error } = await supabase.functions.invoke('fetch-rephonic-metrics', { body });
    if (error) {
      console.warn('[hubspot-resolve] rephonic invoke error:', error.message);
      return empty;
    }
    const key = body.apple_podcast_urls?.[0] || body.podcast_names?.[0];
    const result = data?.results?.[key] || {};
    const desc = typeof result.description === 'string' && result.description.trim()
      ? result.description.trim().slice(0, 65000)
      : null;
    const link = typeof result.listen_url === 'string' && result.listen_url.trim()
      ? result.listen_url.trim()
      : null;
    const email = typeof result.email === 'string' && result.email.trim()
      ? result.email.trim()
      : null;
    const web_url = typeof result.web_url === 'string' && result.web_url.trim()
      ? result.web_url.trim()
      : null;
    const rephonic_url = typeof result.rephonic_url === 'string' && result.rephonic_url.trim()
      ? result.rephonic_url.trim()
      : null;
    return { description: desc, listen_url: link, email, web_url, rephonic_url };
  } catch (err) {
    console.warn('[hubspot-resolve] rephonic fetch error:', err);
    return empty;
  }
}


export async function resolveAssociations(input: ResolveInput): Promise<ResolveResult> {
  const { row, speaker, settings, overrides, dryRun } = input;
  const headers = hubspotHeaders(input.LOVABLE_API_KEY, input.HUBSPOT_API_KEY);
  const generic: string[] = (settings.generic_domains as string[]) || GENERIC_FALLBACK;

  const showUrl = row.show_url || null;
  const showName = overrides.company_name || row.show_name;

  // Domain from the shortlist row's show_url, but skip generic aggregator domains
  // (podcasts.apple.com, spotify.com, etc.) — those are not the show's real home.
  const rawDomainFromShowUrl = parseDomain(showUrl);
  const showUrlDomain = rawDomainFromShowUrl && !generic.includes(rawDomainFromShowUrl)
    ? rawDomainFromShowUrl
    : null;

  // -------- Company resolve (search HubSpot first) --------
  let companyId: string | null = null;
  let companyProps: Record<string, any> = {};
  let companyExisting = false;

  if (showUrl) {
    const hit = await searchObject('companies', {
      filterGroups: [{ filters: [{ propertyName: 'kc_show_url', operator: 'EQ', value: showUrl }] }],
      properties: ['name', 'domain', 'website', 'kc_show_url'],
      limit: 1,
    }, headers);
    if (hit[0]) { companyId = hit[0].id; companyProps = hit[0].properties; companyExisting = true; }
  }
  // Try the user-supplied or show-url-derived domain (skipping generics).
  const overrideDomain = overrides.company_domain && !generic.includes(overrides.company_domain.toLowerCase())
    ? overrides.company_domain.toLowerCase()
    : null;
  const earlyDomain = overrideDomain || showUrlDomain;
  if (!companyId && earlyDomain) {
    const hit = await searchObject('companies', {
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: earlyDomain }] }],
      properties: ['name', 'domain', 'website', 'kc_show_url'],
      limit: 1,
    }, headers);
    if (hit[0]) { companyId = hit[0].id; companyProps = hit[0].properties; companyExisting = true; }
  }
  if (!companyId && showName) {
    const hit = await searchObject('companies', {
      filterGroups: [{ filters: [{ propertyName: 'name', operator: 'EQ', value: showName }] }],
      properties: ['name', 'domain', 'website', 'kc_show_url'],
      limit: 1,
    }, headers);
    if (hit[0]) { companyId = hit[0].id; companyProps = hit[0].properties; companyExisting = true; }
  }

  // -------- Enrich from Rephonic (host email + Rephonic show URL) --------
  // Run for both preview and create when we don't already have a HubSpot match.
  let rephonic: { description: string | null; listen_url: string | null; email: string | null; web_url: string | null; rephonic_url: string | null } = {
    description: null, listen_url: null, email: null, web_url: null, rephonic_url: null,
  };
  if (!companyExisting) {
    rephonic = await fetchRephonicShowData(input.supabase, showUrl, showName);
  }

  // Final domain (for HubSpot dedup-by-domain) — only set when we have a real,
  // non-generic show domain. We intentionally skip Rephonic's web_url here because
  // it's often a feed host (feeds.acast.com, etc.) that would pollute company dedup.
  const finalDomain = overrideDomain || showUrlDomain || null;

  // Website link shown on the company record. Prefer the Rephonic show page —
  // it's a stable canonical reference that links right back to the source data.
  // If the user typed a full URL in the dialog, honor that instead.
  const overrideLooksLikeUrl = !!overrides.company_domain && /^https?:\/\//i.test(overrides.company_domain);
  const finalWebsite = overrideLooksLikeUrl
    ? overrides.company_domain!.trim()
    : (rephonic.rephonic_url || (finalDomain ? `https://${finalDomain}` : showUrl || null));

  const companyWillCreate: Record<string, any> = {
    name: showName,
    ...(finalDomain ? { domain: finalDomain } : {}),
    ...(finalWebsite ? { website: finalWebsite } : {}),
    ...(showUrl ? { kc_show_url: showUrl } : {}),
    kc_created_by_app: 'command_center',
    kc_is_podcast: 'Yes',
  };

  // Resolve HubSpot owner once (by app user email). Used for both company + contact.
  const ownerId = await resolveOwnerIdByEmail(input.callerEmail, headers);
  if (ownerId) companyWillCreate.hubspot_owner_id = ownerId;

  if (!companyId && !dryRun) {
    if (rephonic.description) companyWillCreate.kc_show_notes = rephonic.description;
    if (rephonic.listen_url) companyWillCreate.kc_apple_podcast_link = rephonic.listen_url;

    const resp = await fetch(`${GATEWAY_URL}/crm/v3/objects/companies`, {
      method: 'POST', headers, body: JSON.stringify({ properties: companyWillCreate }),
    });
    if (!resp.ok) throw new Error(`HubSpot create company ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const created = await resp.json();
    companyId = created.id; companyProps = created.properties; companyExisting = false;
  }

  // -------- Contact resolve --------
  const hostName = (overrides.host_first || overrides.host_last)
    ? { first: overrides.host_first || '', last: overrides.host_last || '' }
    : splitHostName(row.host_name);
  // Email priority: explicit override > Rephonic-provided show contact email.
  const hostEmail = overrides.host_email?.trim() || rephonic.email || null;

  let contactId: string | null = null;
  let contactProps: Record<string, any> = {};
  let contactExisting = false;

  if (hostEmail) {
    const hit = await searchObject('contacts', {
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: hostEmail }] }],
      properties: ['firstname', 'lastname', 'email', 'kc_created_for_speaker_id'],
      limit: 1,
    }, headers);
    if (hit[0]) { contactId = hit[0].id; contactProps = hit[0].properties; contactExisting = true; }
  }
  if (!contactId && (hostName.first || hostName.last)) {
    const filters: any[] = [
      { propertyName: 'kc_created_for_speaker_id', operator: 'EQ', value: speaker.id },
    ];
    if (hostName.first) filters.push({ propertyName: 'firstname', operator: 'EQ', value: hostName.first });
    if (hostName.last) filters.push({ propertyName: 'lastname', operator: 'EQ', value: hostName.last });
    const hit = await searchObject('contacts', {
      filterGroups: [{ filters }],
      properties: ['firstname', 'lastname', 'email', 'kc_created_for_speaker_id'],
      limit: 1,
    }, headers);
    if (hit[0]) { contactId = hit[0].id; contactProps = hit[0].properties; contactExisting = true; }
  }

  const contactWillCreate: Record<string, any> = {
    ...(hostName.first ? { firstname: hostName.first } : {}),
    ...(hostName.last ? { lastname: hostName.last } : {}),
    ...(hostEmail ? { email: hostEmail } : {}),
    kc_created_for_speaker_id: speaker.id,
    kc_created_by_app: 'command_center',
    // Explicitly blank — isolate podcast contacts from the sales pipeline.
    hs_lead_status: '',
    lifecyclestage: '',
    ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
  };

  if (!contactId && !dryRun && (hostName.first || hostName.last || hostEmail)) {
    const resp = await fetch(`${GATEWAY_URL}/crm/v3/objects/contacts`, {
      method: 'POST', headers, body: JSON.stringify({ properties: contactWillCreate }),
    });
    if (!resp.ok) throw new Error(`HubSpot create contact ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const created = await resp.json();
    contactId = created.id; contactProps = created.properties; contactExisting = false;
  }

  // -------- Duplicate ticket check (cache first, fall back to live search) --------
  let duplicate_ticket_id: string | null = null;
  if (input.supabase) {
    const { data: cacheHit } = await input.supabase
      .from('hubspot_tickets_cache')
      .select('hubspot_ticket_id')
      .eq('kc_shortlist_id', row.id)
      .eq('pipeline_id', settings.pipeline_id)
      .limit(1)
      .maybeSingle();
    if (cacheHit?.hubspot_ticket_id) duplicate_ticket_id = cacheHit.hubspot_ticket_id;
  }
  if (!duplicate_ticket_id) {
    const dupHit = await searchObject('tickets', {
      filterGroups: [{
        filters: [
          { propertyName: 'kc_shortlist_id', operator: 'EQ', value: row.id },
          { propertyName: 'hs_pipeline', operator: 'EQ', value: settings.pipeline_id },
        ],
      }],
      properties: ['subject'],
      limit: 1,
    }, headers);
    duplicate_ticket_id = dupHit[0]?.id || null;
  }

  return {
    company: { id: companyId, existing: companyExisting, properties: companyProps, will_create: companyExisting ? undefined : companyWillCreate },
    contact: { id: contactId, existing: contactExisting, properties: contactProps, will_create: (contactExisting || !contactId) ? undefined : contactWillCreate },
    duplicate_ticket_id,
    suggested: {
      domain: finalDomain,
      email: rephonic.email || null,
    },
  };
}

export async function associate(
  fromType: string, fromId: string, toType: string, toId: string,
  LOVABLE_API_KEY: string, HUBSPOT_API_KEY: string,
): Promise<void> {
  const headers = hubspotHeaders(LOVABLE_API_KEY, HUBSPOT_API_KEY);
  const resp = await fetch(
    `${GATEWAY_URL}/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`,
    { method: 'PUT', headers },
  );
  if (!resp.ok && resp.status !== 204) {
    const t = await resp.text();
    console.error(`[hubspot-resolve] associate ${fromType}->${toType} ${resp.status}`, t);
  }
}
