

# Skip "Impromptu" Meetings from Matching/Import

## Change
Add a check in both edge functions to skip any meeting whose title contains "Impromptu" (case-insensitive).

### `supabase/functions/sync-fathom-meetings/index.ts`
In the loop over meetings, after extracting `meetingTitle`, skip if it contains "impromptu":
```typescript
if (meetingTitle.toLowerCase().includes("impromptu")) {
  skipped++;
  continue;
}
```

### `supabase/functions/rematch-call-notes/index.ts`
In the loop over unmatched notes, skip any with "impromptu" in the title so they remain unmatched (effectively hidden):
```typescript
if ((note.meeting_title || "").toLowerCase().includes("impromptu")) continue;
```

Two small additions, one per file.

