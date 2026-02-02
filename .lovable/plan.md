
# Airtable API Integration Plan

## Overview
Replace manual CSV uploads with direct Airtable API fetches for speaker activity data, enabling on-demand syncing during report generation and updates.

## Implementation Status

### ✅ Phase 1: Foundation (COMPLETE)
- [x] Created `airtable_connections` table with RLS policies
- [x] Built `fetch-airtable-data` edge function with date filtering and field mapping
- [x] Created `useAirtableConnection` hook for managing connections
- [x] Created `AirtableConnectionDialog` component for setup
- [x] Created `AirtableSyncButton` component for triggering syncs
- [x] Integrated sync option into `UpdateCSVDialog`

### 🔄 Phase 2: UI Integration (IN PROGRESS)
- [x] "Sync from Airtable" button in UpdateCSVDialog
- [ ] Add "Connect Airtable" button in Companies page (company/speaker settings)
- [ ] Add field mapping configuration UI
- [ ] Add connection status indicator in report generation flow

### ⏳ Phase 3: Report Generation Integration
- [ ] Modify initial report generation to optionally fetch from Airtable
- [ ] Add last synced timestamp display
- [ ] Handle multi-speaker filtering with speaker column

## Proposed Architecture

### Data Flow
```text
+------------------+     +----------------------+     +-------------------+
|   Reports UI     | --> |  Supabase Edge Fn    | --> |   Airtable API    |
|  (Sync Button)   |     |  fetch-airtable-data |     |   (Read Records)  |
+------------------+     +----------------------+     +-------------------+
        |                         |
        v                         v
  +-------------+         +------------------+
  | Report Gen  |  <--    | Parsed activity  |
  | Pipeline    |         | data (same shape |
  +-------------+         | as CSV parser)   |
                          +------------------+
```

### New Components

1. **Airtable Connection Storage** (Database)
   - New table `airtable_connections` to store API credentials per campaign manager or company
   - Fields: `id`, `org_id`, `name`, `personal_access_token` (encrypted), `base_id`, `table_id`, `speaker_id` (optional), `company_id` (optional)
   - RLS policies matching existing org-based access

2. **Edge Function: `fetch-airtable-data`**
   - Accepts: `connection_id`, `date_range_start`, `date_range_end`, `speaker_filter` (optional)
   - Uses Airtable REST API to fetch records with date filtering
   - Maps Airtable field names to our `AirtableCSVRow` interface
   - Returns data in same format as `parseAirtableCSV` output

3. **UI Components**
   - **Airtable Connection Setup Dialog**: One-time setup per speaker/company to configure API access
   - **Sync Button** in `UpdateCSVDialog` and report generation: Fetches latest data instead of requiring file upload
   - Connection status indicator showing when Airtable is linked

### Implementation Phases

**Phase 1: Foundation**
- Add `AIRTABLE_API_KEY` secret (or per-user tokens stored encrypted in DB)
- Create `airtable_connections` table with RLS
- Build `fetch-airtable-data` edge function with field mapping

**Phase 2: UI Integration**
- Add "Connect Airtable" flow in speaker/company settings
- Add field mapping configuration (map your column names to our expected fields)
- Add "Sync from Airtable" button alongside CSV upload option

**Phase 3: Report Integration**
- Modify `generateReportData` to optionally fetch from Airtable instead of requiring CSV
- Update `UpdateCSVDialog` to show sync option when connection exists
- Add last synced timestamp display

### Technical Details

**Airtable API Requirements**
- Personal Access Token (PAT) with `data.records:read` scope
- Base ID and Table ID from the Airtable URL
- Field name mapping configuration

**Edge Function Implementation**
```typescript
// fetch-airtable-data/index.ts (conceptual)
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

// Fetch records with date filtering
const records = await fetch(
  `${AIRTABLE_API_URL}/${baseId}/${tableId}?filterByFormula=...`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);

// Map to AirtableCSVRow format
return records.map(record => ({
  podcast_name: record.fields['Podcast Name'],
  action: record.fields['Action'],
  scheduled_date_time: record.fields['Recording Date'],
  date_booked: record.fields['Date Booked'],
  date_published: record.fields['Date Published'],
  link_to_episode: record.fields['Episode Link'],
  // ... etc
}));
```

**Field Mapping Configuration**
Users configure which Airtable column maps to which field:
| Our Field | Airtable Column (configurable) |
|-----------|-------------------------------|
| podcast_name | "Podcast Name" |
| action | "Action" |
| scheduled_date_time | "Recording Date" |
| date_booked | "Date Booked" |
| date_published | "Date Published" |
| link_to_episode | "Episode Link" |

**Multi-Speaker Filtering**
For multi-speaker tables, filter by speaker column:
```
filterByFormula=AND({Speaker}='Maya Reynolds', OR(IS_AFTER({Recording Date}, DATETIME_PARSE('2025-01-01')), ...))
```

### Security Considerations
- Personal Access Tokens stored encrypted in Supabase
- RLS ensures users only access their org's connections
- Edge function validates org_id before using stored credentials
- Tokens never exposed to frontend

### Database Migration
```sql
CREATE TABLE airtable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  company_id UUID REFERENCES companies(id),
  speaker_id UUID REFERENCES speakers(id),
  base_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  personal_access_token TEXT NOT NULL, -- encrypted
  field_mapping JSONB NOT NULL DEFAULT '{}',
  speaker_column_name TEXT, -- for multi-speaker tables
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE airtable_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable access for org" ON airtable_connections
  FOR ALL USING (org_id = get_team_org_id());
```

### User Experience Flow

1. **Setup (one-time per company/speaker)**
   - User clicks "Connect Airtable" in company/speaker settings
   - Enters Personal Access Token, Base ID, Table ID
   - Configures field mapping (with auto-detection from column names)
   - For multi-speaker tables, specifies which column contains speaker names

2. **During Report Generation**
   - If Airtable connected: "Sync from Airtable" button appears
   - Click syncs latest data within date range
   - Falls back to CSV upload if sync fails

3. **During Report Updates**
   - Same "Sync from Airtable" option in UpdateCSVDialog
   - Can refresh just Airtable data without re-uploading other CSVs

### Benefits
- Eliminates manual CSV export/upload workflow
- Always-fresh data on demand
- Reduces user friction for quarterly reports
- Maintains backward compatibility with CSV uploads

### Next Steps After Approval
1. Create database migration for `airtable_connections` table
2. Add `AIRTABLE_API_KEY` secret capability (or use per-connection tokens)
3. Build `fetch-airtable-data` edge function
4. Create Airtable connection setup UI
5. Integrate sync option into existing report flows
