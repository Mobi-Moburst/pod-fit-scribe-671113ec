

## Problem

The toast message after report generation says "Successfully processed 0 podcasts" because it references `report.kpis.total_evaluated`, which counts rows from a Batch Results CSV. When generating a report using only Airtable data (live scoring, no batch CSV upload), this value is 0 even though the report was generated successfully with 8 interviews.

## Fix

Update the toast in `src/pages/Reports.tsx` (line ~722) to use `total_interviews` instead of `total_evaluated`, since `total_interviews` correctly reflects the number of podcast recordings found from Airtable. This is the more meaningful metric regardless of whether a Batch CSV was provided.

**File: `src/pages/Reports.tsx` (~line 722)**

```tsx
// Before:
description: `Successfully processed ${report.kpis.total_evaluated} podcasts with ${report.kpis.total_interviews} interviews.`,

// After:
description: `Successfully processed ${report.kpis.total_interviews} podcasts with ${report.kpis.total_booked} booked and ${report.kpis.total_published} published.`,
```

Single line change, no other files affected.

