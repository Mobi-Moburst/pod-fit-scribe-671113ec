

# Connect Fathom Call Notes to Companies/Speakers

## Overview
Create a `call_notes` table to store meeting transcripts, summaries, and action items from Fathom. New notes arrive automatically via a Fathom webhook, and you can also pull recent meetings on demand. Notes are linked to speakers/companies so they're available when building reports or updating strategies.

## How It Works

1. A new edge function receives Fathom webhook events whenever a meeting finishes processing
2. The webhook payload includes the transcript, summary, and action items
3. The system matches the meeting to a speaker/company (by participant email or name) and stores it
4. On the Companies page, each speaker card shows a "Call Notes" section with recent notes
5. You can also manually trigger a sync to pull recent meetings from Fathom's API

## What Changes

### 1. Database: New `call_notes` table

```text
call_notes
  id              UUID (PK, default gen_random_uuid())
  org_id          UUID (NOT NULL, for RLS)
  company_id      UUID (FK to companies, nullable)
  speaker_id      UUID (FK to speakers, nullable)
  fathom_meeting_id TEXT (unique, to prevent duplicates)
  meeting_title   TEXT
  meeting_date    TIMESTAMPTZ
  duration_seconds INTEGER
  summary         TEXT (Fathom AI summary)
  action_items    JSONB (array of action item objects)
  transcript      TEXT (full transcript)
  participants    JSONB (array of participant names/emails)
  source          TEXT DEFAULT 'fathom' (for future Fireflies support)
  created_at      TIMESTAMPTZ DEFAULT now()
```

RLS policies: same org_id pattern as other tables.

### 2. New Secret: `FATHOM_API_KEY`
- You'll need to generate an API key from Fathom (Settings > API Access)
- We'll store it as a Supabase secret

### 3. New Edge Function: `fathom-webhook`
- Receives POST requests from Fathom's "New meeting content ready" webhook
- Extracts: meeting title, date, summary, transcript, action items, participants
- Attempts to match participants to existing speakers (by name, case-insensitive)
- Inserts a `call_notes` record linked to the matched speaker/company
- If no match is found, still stores the note with `speaker_id = null` for manual linking later
- Registered in `config.toml` with `verify_jwt = false` (it's a public webhook endpoint)

### 4. New Edge Function: `sync-fathom-meetings`
- On-demand pull: fetches recent meetings from Fathom's REST API
- Endpoint: `GET https://api.fathom.ai/external/v1/meetings?include_transcript=true&include_summary=true`
- Auth: `X-Api-Key: FATHOM_API_KEY`
- Deduplicates by `fathom_meeting_id`
- Same speaker-matching logic as the webhook handler

### 5. UI: Call Notes on Companies Page
- Each speaker's expanded card gets a "Call Notes" collapsible section
- Shows recent notes (title, date, summary preview)
- Click to expand and see full summary + action items
- "Sync from Fathom" button in the header to pull latest meetings on demand
- Unmatched notes appear in a separate "Unlinked Notes" section where you can manually assign them to a speaker

## Setup Steps (for you, not code changes)

After we build this, you'll need to:
1. Generate a Fathom API key in Settings > API Access
2. Add it as a secret when prompted
3. In Fathom Settings > Webhooks, create a webhook pointing to the edge function URL
4. Select: include summary, include transcript, include action items
5. Set trigger to: "My recordings" (or "Shared team recordings" if you want all team calls)

## Technical Details

### Fathom Webhook Payload Structure
The webhook POST includes meeting data directly -- no follow-up API call needed. Fields we extract:
- `meeting.title`, `meeting.created_at`, `meeting.duration`
- `summary` (AI-generated meeting summary)
- `action_items` (array with text + assignee)
- `transcript` (array of speaker segments with timestamps)
- `attendees` (names/emails for speaker matching)

### Speaker Matching Logic
```text
For each participant in the meeting:
  1. Exact name match against speakers.name (case-insensitive)
  2. If no match, try partial match (first + last name)
  3. If still no match, leave speaker_id null
  4. If multiple speakers match, link to the first match and store all in participants JSONB
```

### New files
- `supabase/functions/fathom-webhook/index.ts` -- webhook receiver
- `supabase/functions/sync-fathom-meetings/index.ts` -- on-demand sync
- `src/components/call-notes/CallNotesList.tsx` -- UI component for displaying notes
- `src/components/call-notes/SyncFathomButton.tsx` -- sync trigger button

### Modified files
- `supabase/config.toml` -- register new edge functions
- `src/pages/Companies.tsx` -- add call notes section to speaker cards

