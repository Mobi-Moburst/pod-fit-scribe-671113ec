

## Fix Multi-Speaker Double-Counting When Speakers Share the Same Airtable Table

### Problem
When multiple speakers share the same Airtable base/table, each speaker's sync returns filtered rows (filtered by speaker name). But when the system aggregates all speakers' rows into `allAirtableRows`, there's no deduplication. If the Airtable speaker filter doesn't work perfectly (e.g., missing `speaker_column_name`, multi-value fields, or formula rejection fallback), the same booking row appears in multiple speakers' datasets, doubling the company-level KPI counts (e.g., 9 bookings → 18).

### Changes

**1. Edge function: Include Airtable record ID in response**
- File: `supabase/functions/fetch-airtable-data/index.ts`
- Add `record_id: string` to the `AirtableCSVRow` interface
- In `mapRecordToRow`, include `record_id: record.id` from the Airtable response
- This gives the frontend a stable unique key for deduplication

**2. Client-side type: Add record_id to AirtableCSVRow**
- Files: `src/hooks/use-airtable-connection.ts`, `src/types/csv.ts` (if it has AirtableCSVRow)
- Add optional `record_id?: string` field

**3. Deduplicate allAirtableRows in multi-speaker aggregation**
- File: `src/utils/reportGenerator.ts`
- After line 2514 where `allAirtableRows` is assembled, deduplicate by `record_id` (primary) or fallback composite key (`podcast_name + action + scheduled_date_time`) when record_id is missing
- The per-speaker `airtableRows` remain untouched (speaker accordion sections stay accurate)
- Only the company-level aggregation arrays get deduped

**4. Recalculate aggregate KPIs from deduped rows**
- File: `src/utils/reportGenerator.ts`
- In `calculateAggregatedKPIs`, the `total_booked`, `total_published`, `total_recorded`, `total_intro_calls`, and `total_interviews` counts already use `allAirtableRows` directly (lines 2765+), so deduping the input array fixes those
- For `total_booked`/`total_published`/`total_recorded`/`total_intro_calls` (lines 2726-2729), switch from summing speaker breakdowns to counting from the deduped `allAirtableRows` directly, same way `calculateSpeakerKPIs` does it — this prevents double-counting even if per-speaker KPIs overlap

### Technical Detail
The key insight: per-speaker KPI cards in accordions should still show that speaker's individual counts. Only the top-level company KPI cards need deduplication. So the fix is isolated to the aggregation layer — speaker breakdowns remain unchanged.

