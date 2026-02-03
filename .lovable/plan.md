

# Fix: Generate Button Should Allow Airtable-Only Mode

## Problem Identified
The **Generate Report** button is permanently disabled when no Batch Results CSV is uploaded, even though Airtable data has been successfully synced. This prevents testing the "Airtable-only" placeholder mode that was already implemented in the backend logic.

**Root cause:** Line 2188 in `src/pages/Reports.tsx`:
```tsx
disabled={... || !batchFile || !airtableFile}
```
The button checks `!batchFile` directly instead of accounting for the Airtable-only fallback mode.

## Solution
Update the button's `disabled` condition to allow generation when Airtable synced data is available, even without a Batch CSV.

## Changes Required

### File: `src/pages/Reports.tsx`

**Change 1: Button disabled logic (lines 2183-2190)**

```text
Before:
  disabled={
    isProcessing || !dateRangeStart || !dateRangeEnd || 
    (isMultiSpeakerMode 
      ? selectedSpeakerIds.length < 2 || selectedSpeakerIds.some(id => !speakerFiles[id]?.batchFile || !speakerFiles[id]?.airtableFile)
      : !selectedSpeakerId || !batchFile || !airtableFile
    )
  }

After:
  disabled={
    isProcessing || !dateRangeStart || !dateRangeEnd || 
    (isMultiSpeakerMode 
      ? selectedSpeakerIds.length < 2 || selectedSpeakerIds.some(id => {
          const syncedData = speakerSyncedData[id];
          const hasAirtable = !!syncedData || !!speakerFiles[id]?.airtableFile;
          // Allow either batch file OR synced Airtable data
          return (!speakerFiles[id]?.batchFile && !syncedData) || !hasAirtable;
        })
      : !selectedSpeakerId || (!batchFile && !airtableSyncedData?.length) || (!airtableFile && !airtableSyncedData?.length)
    )
  }
```

For single-speaker mode, the key change is:
- `!batchFile` becomes `!batchFile && !airtableSyncedData?.length`
- `!airtableFile` becomes `!airtableFile && !airtableSyncedData?.length`

This means the button is enabled if:
- Batch CSV is uploaded, OR
- Airtable data has been synced (which provides both the activity data AND can generate placeholder batch rows)

**Change 2: Update the Batch CSV badge (lines 2015-2019)**

Make the badge reflect that Batch CSV is optional when Airtable is synced:

```text
Before:
  <Badge variant={batchFile ? "default" : "secondary"}>
    {batchFile ? "Uploaded" : "Required"}
  </Badge>

After:
  <Badge variant={batchFile || airtableSyncedData?.length ? "default" : "secondary"}>
    {batchFile ? "Uploaded" : airtableSyncedData?.length ? "Using Airtable" : "Required"}
  </Badge>
```

## Testing Plan
After this change:
1. Select Dr. Jennifer Berry as the speaker
2. Set a date range (e.g., Q4 2025)
3. Click "Sync from Airtable" - should succeed
4. **Do NOT upload a Batch Results CSV**
5. The Generate Report button should now be **enabled**
6. Click Generate - report should generate with placeholder metrics and show "Estimated Metrics" badge

