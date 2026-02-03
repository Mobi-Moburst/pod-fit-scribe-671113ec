
# Plan: Enable Airtable-Only Report Generation (Test Mode)

## Overview
Add the ability to generate reports using only Airtable data when no Batch Results CSV is available. This is useful for testing the Airtable sync flow and for campaigns where batch evaluation hasn't been completed yet.

## How It Will Work
When generating a report:
- If Airtable data is available but no Batch CSV is uploaded, the system will auto-generate placeholder batch entries from the Airtable podcasts
- These placeholder entries will have reasonable default values so the report doesn't look broken
- A visual indicator will show that the report contains placeholder data

## Technical Changes

### 1. Update Reports.tsx Validation (lines 559-566)
**Current behavior**: Blocks report generation if `batchFile` is missing

**New behavior**: 
- If `airtableSyncedData` exists with podcasts, allow generation without batch file
- Show an informational toast noting that placeholder metrics are being used

```text
Before:
  if (!batchFile) → show error, return

After:
  if (!batchFile && !airtableSyncedData?.length) → show error, return
  if (!batchFile && airtableSyncedData?.length) → continue with placeholder mode
```

### 2. Generate Mock Batch Data from Airtable
Create a helper function that converts Airtable rows into placeholder batch entries:

```text
function generateMockBatchFromAirtable(airtableRows):
  For each Airtable row with "podcast recording" action:
    - show_title: row.podcast_name
    - verdict: "Consider" (neutral default)
    - overall_score: 7.5 (reasonable middle score)
    - listeners_per_episode: 5000 (typical podcast)
    - monthly_listens: 20000
    - categories: "Podcast" (generic)
    - status: "success"
```

### 3. Add Placeholder Indicator to Report
Add a flag to the report data so the UI can optionally display a "Contains estimated data" badge:

```text
report_data: {
  ...existing fields,
  contains_placeholder_data?: boolean
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Reports.tsx` | Relax batch file validation, generate mock batch rows when missing |
| `src/utils/reportGenerator.ts` | Add `generateMockBatchFromAirtable()` helper function |
| `src/types/reports.ts` | Add `contains_placeholder_data?: boolean` to ReportData interface |

## What You'll Be Able to Test
With this change, you can:
1. Sync Dr. Jennifer Berry's Airtable data
2. Generate a report without uploading a batch CSV
3. Verify that the following populate correctly from Airtable:
   - Published Episodes Carousel (podcasts with episode links)
   - Total Booked count
   - Total Published count
   - Categories (AI-generated from booked podcasts)
4. See placeholder values for:
   - Fit/Consider/Not breakdown
   - Total Reach
   - Average Score

## Alternative: Simpler Approach
If you just want to quickly test without code changes, you could create a minimal "mock" batch CSV with the same podcast names from Airtable. I can generate this for you if you share the podcast names from the Airtable sync.
