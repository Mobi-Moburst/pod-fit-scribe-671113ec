

# Plan: Generate Fit Scores at Report Time from Airtable Show Notes

## Overview
Replace the dependency on the Batch Results CSV for podcast fit scores by generating them on-the-fly during report creation. For each podcast in the Airtable data (within the selected date range), the system will use the "Show Notes" column to scrape/fetch the show notes content and then run it through the existing `analyze` edge function to produce a fit score and verdict.

## Current Flow
1. User uploads a **Batch Results CSV** containing pre-computed `overall_score`, `verdict`, `listeners_per_episode`, etc.
2. User syncs or uploads **Airtable data** containing booking/publishing info
3. The two are merged by podcast title in `mergePodcastData()`
4. KPIs (avg score, fit/consider/not counts) are calculated from the batch CSV rows

## New Flow
1. User syncs **Airtable data** (which includes a `show_notes` column -- this could be a URL or text)
2. At report generation time, for each Airtable podcast with a "podcast recording" action:
   - If `show_notes` looks like a URL, scrape it via the existing `scrape` edge function to get text content
   - Pass the show notes text + client profile to the `analyze` edge function (same logic used in the Evaluate/Batch pages)
   - Receive back `overall_score`, `verdict`, rubric breakdown, etc.
3. These scores replace what would have come from the batch CSV
4. The Batch CSV becomes **optional** -- if provided, its scores take precedence; if not, live-scored data is used

## Technical Changes

### 1. New Utility: `scoreAirtablePodcasts()` in `src/utils/reportGenerator.ts`

```text
async function scoreAirtablePodcasts(
  airtableRows: AirtableCSVRow[],
  client: MinimalClient,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchCSVRow[]>

For each row with "podcast recording" action:
  1. Get show_notes content:
     - If show_notes starts with "http", call scrape edge function
     - Otherwise use the text directly
  2. Call analyze edge function with { client, show_notes }
  3. Map result to BatchCSVRow format:
     - show_title: row.podcast_name
     - verdict: mapped from analyze result (recommend->Fit, consider->Consider, not_recommended->Not)
     - overall_score: from analyze result
     - listeners_per_episode: undefined (not available from show notes)
     - status: 'success' or 'failed'
  4. Process in batches of 3-5 to avoid overwhelming the API
  5. Return array of BatchCSVRow
```

### 2. Update `src/pages/Reports.tsx` - Report Generation Flow

- Remove the hard requirement for `batchFile`
- When `batchFile` is not provided but Airtable data exists:
  - Call `scoreAirtablePodcasts()` to generate scores on the fly
  - Show a progress indicator ("Scoring podcast 3 of 12...")
  - Pass the generated batch rows into `generateReportFromMultipleCSVs()`
- When `batchFile` IS provided, use existing flow (batch CSV scores take priority)
- Add a progress state variable for scoring feedback

### 3. Update Validation Logic in `Reports.tsx` (around line 559)

```text
Current:
  if (!batchFile) -> error "Batch Results CSV is required"

New:
  if (!batchFile && !airtableSyncedData?.length) -> error "Upload batch CSV or sync Airtable data"
  if (!batchFile && airtableSyncedData?.length) -> proceed with live scoring
```

### 4. Add `contains_live_scores` Flag to `ReportData` in `src/types/reports.ts`

Add an optional field to indicate scores were generated at report time rather than from a pre-computed batch:
- `contains_live_scores?: boolean` -- allows UI to optionally show an indicator

### 5. Airtable Show Notes Handling

The `show_notes` field from Airtable may contain:
- A URL to the podcast's show notes page -- needs scraping via the `scrape` edge function first
- Raw text content -- can be passed directly to `analyze`
- Empty/missing -- skip scoring for that podcast, assign default values

The detection is simple: if the value starts with `http://` or `https://`, treat it as a URL and scrape it.

## Processing Flow

```text
User clicks "Generate Report" (no batch CSV uploaded)
  |
  v
Filter Airtable rows -> only "podcast recording" actions
  |
  v
For each podcast (batches of 3):
  |-> If show_notes is URL -> call scrape() -> get text
  |-> If show_notes is text -> use directly
  |-> If show_notes empty -> skip (assign score 0, verdict "Not")
  |
  v
Call analyze() with { client profile, show_notes text }
  |
  v
Collect results as BatchCSVRow[]
  |
  v
Pass to generateReportFromMultipleCSVs() (existing flow)
  |
  v
Report generated with live scores
```

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/reportGenerator.ts` | Add `scoreAirtablePodcasts()` function |
| `src/pages/Reports.tsx` | Relax batch file validation, call scoring when no batch CSV, add progress state |
| `src/types/reports.ts` | Add `contains_live_scores?: boolean` to `ReportData` |

## Edge Cases and Considerations

- **Rate limiting**: Process podcasts in batches of 3 with small delays between batches to avoid overwhelming the analyze edge function
- **Timeout**: Each analyze call may take 2-5 seconds; for 15 podcasts this could be 30-75 seconds total. The progress indicator keeps the user informed.
- **Failed scrapes**: If a show notes URL fails to scrape, the podcast gets a default score of 0 with verdict "Not" and a note explaining the failure
- **No show notes**: Podcasts without show notes content skip scoring
- **Listeners/reach data**: Not available from show notes alone -- these fields will be empty. If a Rephonic CSV is uploaded, those values supplement the data as they do today.
- **Batch CSV override**: If both a batch CSV and Airtable data are provided, the batch CSV scores take priority (existing behavior preserved)
