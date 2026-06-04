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

    // Resolve Airtable connection: speaker-level first, then company-level
    let connection: any = null;
    if (speaker_id) {
      const { data } = await supabase
        .from('airtable_connections')
        .select('*')
        .eq('speaker_id', speaker_id)
        .order('updated_at', { ascending: false })
        .limit(1);
      connection = data?.[0] || null;
    }
    if (!connection) {
      const { data } = await supabase
        .from('airtable_connections')
        .select('*')
        .eq('company_id', company_id)
        .is('speaker_id', null)
        .order('updated_at', { ascending: false })
        .limit(1);
      connection = data?.[0] || null;
    }

    if (!connection) {
      return new Response(
        JSON.stringify({ success: true, net_impressions_lifetime: 0, bookings_considered: 0, missing_metadata: 0, reason: 'No Airtable connection' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const fieldMapping: FieldMapping = (connection.field_mapping as FieldMapping) || {};
    const accessToken = (typeof connection.personal_access_token === 'string' ? connection.personal_access_token.trim() : '')
      || Deno.env.get('AIRTABLE_PAT')?.trim();
    if (!accessToken) throw new Error('No Airtable access token configured');

    // Optional speaker filter
    let filterFormula: string | undefined;
    if (speaker_name) {
      const speakerField = connection.speaker_column_name?.trim() || 'speaker';
      filterFormula = `{${speakerField}}='${speaker_name.replace(/'/g, "\\'")}'`;
    }

    const records = await fetchAllRecords(connection.base_id, connection.table_id, accessToken, filterFormula);
    console.log(`Fetched ${records.length} lifetime records`);

    const actionField = fieldMapping.action || 'Action';
    const bookedField = fieldMapping.date_booked || 'Date Booked';
    const appleField = fieldMapping.apple_podcast_link || 'Apple Podcast Link';
    const nameField = fieldMapping.podcast_name || 'Podcast Name';

    // Filter to bookings (podcast recording action) with valid date_booked
    type Booking = { apple?: string; name?: string; date_booked: Date };
    const bookings: Booking[] = [];
    for (const rec of records) {
      const f = rec.fields;
      const action = String(f[actionField] || '').toLowerCase();
      if (!action.includes('podcast recording')) continue;
      const dbRaw = f[bookedField];
      if (!dbRaw) continue;
      const d = new Date(dbRaw);
      if (isNaN(d.getTime())) continue;
      bookings.push({
        apple: f[appleField] ? String(f[appleField]) : undefined,
        name: f[nameField] ? String(f[nameField]) : undefined,
        date_booked: d,
      });
    }

    // Look up monthly_listens from podcast_metadata_cache by apple URL
    const appleUrls = Array.from(new Set(bookings.map((b) => b.apple).filter(Boolean))) as string[];
    const metaByUrl = new Map<string, number>();
    if (appleUrls.length > 0) {
      // chunk to avoid huge IN lists
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
    for (const b of bookings) {
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
        bookings_considered: bookings.length,
        bookings_with_metadata: withMeta,
        missing_metadata: missing,
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
