## Goal

Let team members who don't use Fireflies (e.g. Ruhani's Google Meet summaries) paste meeting notes into the tool. Notes land in the same `call_notes` table that powers Strategy Insights, Synced Calls, and speaker timelines — no separate silo.

## Placement

New standalone Settings entry:

- New row on `/settings` titled **"Upload meeting notes"** (icon: `FileText`, description: "Paste a Google Meet, Zoom, or any meeting summary."). Sits right under the existing Integrations / Synced Calls rows.
- Opens a new page at `/settings/upload-notes` (`src/pages/UploadNotes.tsx`).
- Available to all signed-in users (admin + user). Viewers excluded.

This keeps the Integrations page focused on third-party connections and avoids cluttering Synced Calls.

## Upload page UX

Single-column form, matching the existing Settings aesthetic:

1. **Company** dropdown (required) — uses the same Company → Speaker selector pattern already in the app.
2. **Speaker** dropdown (optional) — filtered by selected company; defaults to "Company-wide note".
3. **Meeting title** (required, e.g. "Q2 Strategy Sync").
4. **Meeting date** (date picker, defaults to today).
5. **Notes / summary** (large textarea, required, 50–20,000 chars). Helper text: "Paste the full Google Meet, Zoom, or manual summary. Markdown is supported."
6. **Save note** button.

After save: toast confirmation + form resets + a "Recent uploads by you" list below shows the last 10 manual notes (title, company, speaker, date, delete button).

## Data flow

Insert directly into existing `call_notes` table — no schema change needed. Fields used:

- `source: 'manual'` (new value alongside `'fireflies'` and `'fathom'`)
- `meeting_title`, `meeting_date`, `summary` (the pasted body), `company_id`, `speaker_id`, `org_id`
- `participants: []`, `action_items: []`, `transcript: null`
- `created_at` auto

Existing components already render any row regardless of `source`, so:

- Strategy Insights Digest picks it up automatically.
- Synced Calls page lists it (we'll add a small "Manual" badge to distinguish source).
- Speaker / company timelines include it.

## Edge function

New `supabase/functions/upload-manual-note/index.ts`:

- Validates JWT, validates body with Zod (title 1–200, summary 50–20000, valid UUIDs, date parseable).
- Confirms `company_id` (and `speaker_id` if provided) belong to the caller's org.
- Inserts into `call_notes` with `source='manual'` using service role.
- Returns the inserted row.

A delete endpoint isn't needed — RLS already lets org members delete their own org's `call_notes`, so the page can call `supabase.from('call_notes').delete()` directly for the "Recent uploads" list.

## Files

- New: `src/pages/UploadNotes.tsx`
- New: `supabase/functions/upload-manual-note/index.ts`
- Edit: `src/pages/Settings.tsx` — add the new card linking to `/settings/upload-notes`
- Edit: `src/App.tsx` — register the new route inside `ProtectedRoute`
- Edit: `src/components/call-notes/CallNotesList.tsx` (and/or Synced Calls) — render a small "Manual" badge when `source === 'manual'`

## Non-goals (deferred)

- No file upload, no Google Doc URL ingestion, no AI cleanup of pasted text. Pure paste-in, save, done.
- No editing of existing notes (delete + re-paste covers it for v1).
