

# Fix Speaker Matching: Exclude Internal Kitcaster Team and Add Company-Name Priority

## Problem
The call "Kitcaster x ProArch Monthly Check-In" matched to **Ryan Estes** (Kitcaster's own speaker) instead of a ProArch speaker, because the participant entry "Brandy Whalen and Ryan Estes" triggered a partial name match before the actual client speakers were checked. Additionally, "James Spignardo" doesn't match "Jim Spignardo" (name variation).

## Root Cause
The matching logic treats all speakers equally — it doesn't know that Kitcaster speakers are internal team members who should never be the "matched client speaker" on a call.

## Solution

### Both `sync-fathom-meetings/index.ts` and `rematch-call-notes/index.ts`:

1. **Exclude Kitcaster speakers from matching** — filter out any speaker whose `company_id` matches the Kitcaster company (`0d1e306e-159a-4cf3-a9f5-0a6c40488ed5`). These are internal team, never clients.

2. **Add company-name matching from meeting title as a new top-priority tier** — before any participant name matching, scan the meeting title for company names. If "ProArch" appears in "Kitcaster x ProArch Monthly Check-In", immediately narrow to ProArch speakers and pick the first match from participants. This handles the common "Kitcaster x [Client] Check-In" pattern.

3. **Add nickname/short-name handling** — match "James" to "Jim", "James" to "Jimmy", etc. using a small common-nicknames map, so "James Spignardo" matches "Jim Spignardo".

### Updated matching flow:
```text
0. Filter out Kitcaster-company speakers entirely
1. NEW: Check meeting title for company names → if found, prefer speakers from that company
2. Exact/partial name match from participants (with nickname expansion)
3-6. Existing tiers (title/summary scan, email matching, etc.)
```

### Files to edit:
- `supabase/functions/sync-fathom-meetings/index.ts` — update `matchSpeaker`, add company-name fetch with names, add nickname map
- `supabase/functions/rematch-call-notes/index.ts` — same changes to its `matchSpeaker`, fetch companies with names

