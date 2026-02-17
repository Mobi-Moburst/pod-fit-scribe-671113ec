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

interface AirtableCSVRow {
  podcast_name: string;
  apple_podcast_link?: string;
  action: string;
  scheduled_date_time: string;
  show_notes?: string;
  date_booked?: string;
  date_published?: string;
  link_to_episode?: string;
}

interface FieldMapping {
  podcast_name: string;
  action: string;
  scheduled_date_time: string;
  date_booked?: string;
  date_published?: string;
  link_to_episode?: string;
  show_notes?: string;
  apple_podcast_link?: string;
}

// Build Airtable filter formula for date range
function buildDateFilterFormula(
  dateRangeStart: string,
  dateRangeEnd: string,
  fieldMapping: FieldMapping,
  speakerColumnName?: string,
  speakerName?: string
): string {
  const scheduledField = fieldMapping.scheduled_date_time || 'Recording Date';
  const publishedField = fieldMapping.date_published || 'Date Published';
  const bookedField = fieldMapping.date_booked || 'Date Booked';

  // Date range conditions - include if ANY date falls in range
  const dateConditions = [
    `AND(IS_AFTER({${scheduledField}}, DATETIME_PARSE('${dateRangeStart}')), IS_BEFORE({${scheduledField}}, DATETIME_PARSE('${dateRangeEnd}')))`,
    `AND(IS_AFTER({${publishedField}}, DATETIME_PARSE('${dateRangeStart}')), IS_BEFORE({${publishedField}}, DATETIME_PARSE('${dateRangeEnd}')))`,
    `AND(IS_AFTER({${bookedField}}, DATETIME_PARSE('${dateRangeStart}')), IS_BEFORE({${bookedField}}, DATETIME_PARSE('${dateRangeEnd}')))`,
  ];

  let formula = `OR(${dateConditions.join(', ')})`;

  // Add speaker filter if provided
  if (speakerColumnName && speakerName) {
    formula = `AND({${speakerColumnName}}='${speakerName}', ${formula})`;
  }

  return formula;
}

// Map Airtable record to our standard format
// Try multiple field name variations for a given mapping key
function getFieldValue(fields: Record<string, any>, mappedName: string | undefined, ...fallbacks: string[]): string | undefined {
  if (mappedName && fields[mappedName] !== undefined && fields[mappedName] !== null) {
    return fields[mappedName];
  }
  for (const fallback of fallbacks) {
    if (fields[fallback] !== undefined && fields[fallback] !== null) {
      return fields[fallback];
    }
  }
  return undefined;
}

function mapRecordToRow(record: AirtableRecord, fieldMapping: FieldMapping): AirtableCSVRow {
  const fields = record.fields;
  
  return {
    podcast_name: fields[fieldMapping.podcast_name] || '',
    action: fields[fieldMapping.action] || '',
    scheduled_date_time: fields[fieldMapping.scheduled_date_time] || '',
    date_booked: fieldMapping.date_booked ? fields[fieldMapping.date_booked] : undefined,
    date_published: fieldMapping.date_published ? fields[fieldMapping.date_published] : undefined,
    link_to_episode: getFieldValue(fields, fieldMapping.link_to_episode, 'Link to episode', 'Episode Link', 'link_to_episode', 'Episode link'),
    show_notes: fieldMapping.show_notes ? fields[fieldMapping.show_notes] : undefined,
    apple_podcast_link: fieldMapping.apple_podcast_link ? fields[fieldMapping.apple_podcast_link] : undefined,
  };
}

// Fetch all records with pagination
async function fetchAllRecords(
  baseId: string,
  tableId: string,
  accessToken: string,
  filterFormula?: string
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    if (offset) {
      params.append('offset', offset);
    }

    const url = `${AIRTABLE_API_URL}/${baseId}/${tableId}?${params.toString()}`;
    console.log(`Fetching from Airtable: ${url.replace(accessToken, '[REDACTED]')}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Airtable API error: ${response.status} - ${errorText}`);
      throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
    }

    const data: AirtableResponse = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;

    console.log(`Fetched ${data.records.length} records, total: ${allRecords.length}`);
  } while (offset);

  return allRecords;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      connection_id,
      date_range_start,
      date_range_end,
      speaker_name // Optional: for multi-speaker tables
    } = await req.json();

    console.log(`Fetching Airtable data for connection: ${connection_id}`);
    console.log(`Date range: ${date_range_start} to ${date_range_end}`);

    if (!connection_id) {
      throw new Error('connection_id is required');
    }

    // Fetch connection details from database
    const { data: connection, error: connectionError } = await supabase
      .from('airtable_connections')
      .select('*')
      .eq('id', connection_id)
      .single();

    if (connectionError || !connection) {
      console.error('Connection fetch error:', connectionError);
      throw new Error('Airtable connection not found');
    }

    console.log(`Found connection: ${connection.name}`);

    const fieldMapping: FieldMapping = connection.field_mapping as FieldMapping;

    // Build filter formula
    let filterFormula: string | undefined;
    if (date_range_start && date_range_end) {
      filterFormula = buildDateFilterFormula(
        date_range_start,
        date_range_end,
        fieldMapping,
        connection.speaker_column_name,
        speaker_name
      );
      console.log(`Filter formula: ${filterFormula}`);
    }

    // Use global secret if available, fallback to per-connection token
    const globalToken = Deno.env.get('AIRTABLE_PAT');
    const accessToken = connection.personal_access_token || globalToken;

    if (!accessToken) {
      throw new Error('No Airtable access token configured. Please add AIRTABLE_PAT secret or provide a per-connection token.');
    }

    // Fetch records from Airtable
    const records = await fetchAllRecords(
      connection.base_id,
      connection.table_id,
      accessToken,
      filterFormula
    );

    console.log(`Total records fetched: ${records.length}`);

    // Map records to our format
    const rows: AirtableCSVRow[] = records.map(record => 
      mapRecordToRow(record, fieldMapping)
    );

    // Update last_synced_at timestamp
    await supabase
      .from('airtable_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection_id);

    return new Response(
      JSON.stringify({
        success: true,
        data: rows,
        count: rows.length,
        synced_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching Airtable data:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
