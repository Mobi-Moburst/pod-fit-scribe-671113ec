

# Add Synced Airtable Data Preview Table

## Overview
After syncing Airtable data, add a collapsible preview table that shows the actual records returned. This will help you verify that fields like `podcast_name`, `action`, `date_published`, `date_booked`, etc. are mapping correctly before generating a report.

## What You'll See
- After a successful Airtable sync, a small expandable section appears below the "Synced (8)" badge
- Clicking it reveals a scrollable table showing all synced records with their key fields
- The table will display: Podcast Name, Action, Recording Date, Date Booked, Date Published, Episode Link, and Show Notes (truncated)
- This works for both single-speaker and multi-speaker report flows

## Technical Details

### Changes to `src/pages/Reports.tsx`

1. **Add an "eyeball" toggle** next to the Synced badge (or make the badge itself clickable) that expands/collapses a preview panel.

2. **Add state** to track whether the preview is expanded:
   - `airtablePreviewOpen` (boolean) for single-speaker flow
   - `speakerAirtablePreviewOpen` (Record of speakerId to boolean) for multi-speaker flow

3. **Render a preview table** when expanded, using the existing synced data arrays (`airtableSyncedData` / `speakerSyncedData[speakerId]`). The table will show columns:
   - Podcast Name
   - Action
   - Recording Date
   - Date Booked
   - Date Published
   - Episode Link (truncated/linked)
   - Show Notes (first ~50 chars)

4. **Wrap in a Collapsible** component (already available via Radix) or a simple conditional render with a max-height scroll container so it doesn't overwhelm the form layout.

### No backend changes needed
The data is already fully available in the component state after sync. This is purely a UI addition to surface what's already there.

