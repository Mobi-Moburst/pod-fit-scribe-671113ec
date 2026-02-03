
# Plan: Enable Airtable-Only Report Generation (Test Mode) ✅ IMPLEMENTED

## Overview
Add the ability to generate reports using only Airtable data when no Batch Results CSV is available. This is useful for testing the Airtable sync flow and for campaigns where batch evaluation hasn't been completed yet.

## Implementation Status: COMPLETE

### Changes Made:

1. **`src/types/reports.ts`** - Added `contains_placeholder_data?: boolean` to ReportData interface

2. **`src/utils/reportGenerator.ts`** - Added `generateMockBatchFromAirtable()` function that:
   - Filters Airtable rows to only "podcast recording" actions
   - Creates placeholder batch entries with neutral defaults (verdict: "Consider", score: 7.5, listeners: 5000)

3. **`src/pages/Reports.tsx`** - Updated validation logic:
   - Relaxed batch file requirement when Airtable synced data exists
   - Uses `generateMockBatchFromAirtable()` when no batch CSV provided
   - Sets `contains_placeholder_data = true` on generated reports
   - Shows informational toast about placeholder metrics

4. **`src/components/reports/ReportHeader.tsx`** - Added visual indicator:
   - New `isPlaceholder` prop
   - Shows "Estimated Metrics" badge with warning icon when using placeholder data

## How to Test
1. Select Dr. Jennifer Berry from SmartLab Learning
2. Set quarter/date range
3. Sync from Airtable (without uploading a Batch CSV)
4. Click "Generate Report"
5. Report should generate with "Estimated Metrics" badge and placeholder fit scores
