

# Make Rephonic CSV Optional (Podchaser Auto-Fetches Metrics)

## The Problem
The report builder UI still shows "Rephonic CSV *" with a "Required" badge, even though Podchaser now auto-fetches podcast metrics. This is confusing -- users think they still need to upload a CSV manually.

## What Will Change

### 1. Update the Rephonic CSV label and badge (single-speaker mode)
- Change `Rephonic CSV *` to `Rephonic CSV` (remove the asterisk)
- Change the badge from "Required" to "Optional" when no file is uploaded
- Add helper text: "Podcast metrics are auto-fetched via Podchaser. Upload a CSV only to override."

### 2. Update the Rephonic CSV label and badge (multi-speaker mode)
- Same changes in the per-speaker accordion sections: remove the asterisk and update badge text
- Add the same helper text about Podchaser auto-fetching

### 3. Add a Podchaser status indicator
- After report generation, if Podchaser data was used, show a small note in the generation output (e.g., "Podcast metrics: Auto-fetched via Podchaser" or "Podcast metrics: From uploaded CSV")

### 4. Page subtitle update
- Change "Upload CSVs to generate a comprehensive campaign report" to something like "Generate a comprehensive campaign report with KPIs and metrics" since CSVs are no longer the primary data source

## Technical Details

All changes are in `src/pages/Reports.tsx`:

**Lines 2083-2092** (single-speaker Rephonic section):
- Remove the `*` from the label
- Change badge text from `"Required"` to `"Optional"`
- Add a `<p>` helper text below the input

**Lines 1982-1984** (multi-speaker Rephonic section):
- Remove the `*` from `"Rephonic CSV *"`
- Add helper text

**No validation changes needed** -- the generate button already does not require `batchFile`. It only checks for date range and Airtable data.

