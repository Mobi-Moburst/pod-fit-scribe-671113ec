import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, any>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface FieldMapping {
  podcast_name?: string;
  action?: string;
  scheduled_date_time?: string;
  date_booked?: string;
  date_published?: string;
  apple_podcast_link?: string;
  link_to_episode?: string;
}

async function fetchAllRecords(
  baseId: string,
  tableId: string,
  accessToken: string,
  filterFormula?: string,
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  let useFilter = !!filterFormula;
  let keepGoing = true;

  while (keepGoing) {
    const params = new URLSearchParams();
    if (useFilter && filterFormula) params.append('filterByFormula', filterFormula);
    if (offset) params.append('offset', offset);

    const url = `${AIRTABLE_API_URL}/${baseId}/${tableId}?${params.toString()}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 422 && useFilter) {
        console.warn(`Filter rejected (422), retrying unfiltered: ${txt}`);
        useFilter = false;
        offset = undefined;
        all.length = 0;
        continue;
      }
      throw new Error(`Airtable API error: ${resp.status} - ${txt}`);
    }

    const data: AirtableResponse = await resp.json();
    all.push(...data.records);
    offset = data.offset;
    keepGoing = !!offset;
  }

  return all;
}

function monthsBetween(start: Date, end: Date): number {
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + (end.getDate() >= start.getDate() ? 1 : 0);
  return Math.max(0, months);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { company_id, speaker_id, speaker_name } = await req.json();
    if (!company_id) throw new Error('company_id is required');

    // Resolve Airtable connection(s):
    //  - Single-speaker report: speaker-level first, then company-level
    //  - Multi-speaker report (no speaker_id): company-level first; if none, fan out
    //    across ALL speaker-level connections for the company.
    let connections: any[] = [];
    if (speaker_id) {
      const { data } = await supabase
        .from('airtable_connections')
        .select('*')
        .eq('speaker_id', speaker_id)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (data?.[0]) connections = [data[0]];
    }
    if (connections.length === 0) {
      const { data: companyLevel } = await supabase
        .from('airtable_connections')
        .select('*')
        .eq('company_id', company_id)
        .is('speaker_id', null)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (companyLevel?.[0]) {
        connections = [companyLevel[0]];
      } else if (!speaker_id) {
        // Multi-speaker fallback: gather every speaker-level connection for this company.
        const { data: speakerLevel } = await supabase
          .from('airtable_connections')
          .select('*, speakers!inner(id, name)')
          .eq('company_id', company_id)
          .not('speaker_id', 'is', null);
        connections = speakerLevel || [];
      }
    }

    if (connections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, net_impressions_lifetime: 0, bookings_considered: 0, missing_metadata: 0, reason: 'No Airtable connection' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const envToken = Deno.env.get('AIRTABLE_PAT')?.trim();
    type Booking = { apple?: string; name?: string; date_booked: Date; rec_id: string };
    const allBookings: Booking[] = [];
    const seenRecIds = new Set<string>();

    for (const connection of connections) {
      const fieldMapping: FieldMapping = (connection.field_mapping as FieldMapping) || {};
      const accessToken = (typeof connection.personal_access_token === 'string' ? connection.personal_access_token.trim() : '')
        || envToken;
      if (!accessToken) continue;

      // Optional speaker filter (only for single-speaker fetch on a shared base)
      let filterFormula: string | undefined;
      const effectiveSpeakerName = speaker_name || connection.speakers?.name;
      if (speaker_id && effectiveSpeakerName) {
        const speakerField = connection.speaker_column_name?.trim() || 'speaker';
        filterFormula = `{${speakerField}}='${effectiveSpeakerName.replace(/'/g, "\\'")}'`;
      }

      let records: AirtableRecord[] = [];
      try {
        records = await fetchAllRecords(connection.base_id, connection.table_id, accessToken, filterFormula);
      } catch (e) {
        console.warn(`Airtable fetch failed for base=${connection.base_id} table=${connection.table_id}:`, e);
        continue;
      }
      console.log(`Fetched ${records.length} records from ${connection.base_id}/${connection.table_id}`);

      const actionField = fieldMapping.action || 'Action';
      const bookedField = fieldMapping.date_booked || 'Date Booked';
      const appleField = fieldMapping.apple_podcast_link || 'Apple Podcast Link';
      const nameField = fieldMapping.podcast_name || 'Podcast Name';

      for (const rec of records) {
        const f = rec.fields;
        const action = String(f[actionField] || '').toLowerCase();
        if (!action.includes('podcast recording')) continue;
        const dbRaw = f[bookedField];
        if (!dbRaw) continue;
        const d = new Date(dbRaw);
        if (isNaN(d.getTime())) continue;
        // Dedupe across bases by Airtable record id (memory: multi-speaker dedup rule)
        const key = `${connection.base_id}:${rec.id}`;
        if (seenRecIds.has(key)) continue;
        seenRecIds.add(key);
        allBookings.push({
          apple: f[appleField] ? String(f[appleField]) : undefined,
          name: f[nameField] ? String(f[nameField]) : undefined,
          date_booked: d,
          rec_id: rec.id,
        });
      }
    }

    // Look up monthly_listens from podcast_metadata_cache by apple URL
    const appleUrls = Array.from(new Set(allBookings.map((b) => b.apple).filter(Boolean))) as string[];
    const metaByUrl = new Map<string, number>();
    if (appleUrls.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < appleUrls.length; i += chunkSize) {
        const chunk = appleUrls.slice(i, i + chunkSize);
        const { data: meta } = await supabase
          .from('podcast_metadata_cache')
          .select('apple_podcast_url, monthly_listens')
          .in('apple_podcast_url', chunk);
        for (const row of meta || []) {
          if (row.apple_podcast_url && typeof row.monthly_listens === 'number') {
            metaByUrl.set(row.apple_podcast_url, row.monthly_listens);
          }
        }
      }
    }

    const now = new Date();
    let total = 0;
    let withMeta = 0;
    let missing = 0;
    for (const b of allBookings) {
      const listens = b.apple ? (metaByUrl.get(b.apple) || 0) : 0;
      if (!listens) { missing++; continue; }
      const months = monthsBetween(b.date_booked, now) || 1;
      total += listens * months;
      withMeta++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        net_impressions_lifetime: Math.round(total),
        bookings_considered: allBookings.length,
        bookings_with_metadata: withMeta,
        missing_metadata: missing,
        connections_used: connections.length,
        computed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('compute-lifetime-impressions error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
