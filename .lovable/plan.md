

# Fix Call Notes Matching and Sync Error

## Problem 1: Orphaned Call Notes
The call note "Tyler Wells x Kitcaster Check-In" (id: `7aa08cde...`) has participants `[Tyler Wells, Troy Higgins, ...]` but `speaker_id` and `company_id` are null. The speaker "Tyler Wells" exists in the DB (id: `967fa880...`, company: BrainGrid `2eb0dd0b...`). The webhook likely ran before the speaker record existed. There's no way to re-match orphaned notes.

## Problem 2: Fathom Sync DNS Error
The `sync-fathom-meetings` edge function fails because the Supabase edge runtime can't resolve `api.fathom.video`. This is an infrastructure-level DNS issue — the code is correct. We can't fix DNS from code, but we can improve error handling and add a fallback re-matching mechanism.

## Solution

### 1. New edge function: `rematch-call-notes`
Create a new edge function that re-runs the speaker matching logic on all call notes where `speaker_id IS NULL`. This fixes orphaned notes and can be triggered manually.

- Query all unmatched call notes (`speaker_id IS NULL`)
- For each, run the same multi-tier matching against current speakers/companies
- Update matched records

### 2. Update `SyncFathomButton` component
Add a secondary "Re-match" button (or run re-matching automatically after sync). If sync fails due to DNS, still offer to re-match existing orphaned notes.

### 3. Improve sync error message
Show a more helpful error when DNS/network fails, suggesting the user try again later and offering the re-match option.

## Files to create/edit
- **Create** `supabase/functions/rematch-call-notes/index.ts` — re-matching edge function
- **Edit** `src/components/call-notes/SyncFathomButton.tsx` — add re-match button, improve error UX

