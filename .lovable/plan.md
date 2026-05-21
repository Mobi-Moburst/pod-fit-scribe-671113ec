## Goal

Replace Fathom with Fireflies as the meeting notetaker source. Each Kitcaster CM connects their own Fireflies API key. Scope = **setup only**: connection storage, UI, sync. Fathom removal and matching/insights rewiring come next.

---

## 1. Database

New table `fireflies_connections` (one row per CM):

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `user_id` | auth.uid, unique |
| `org_id` | for RLS |
| `api_key` | the CM's Fireflies key |
| `fireflies_user_id`, `fireflies_email`, `fireflies_name` | captured on connect via `users` query |
| `last_synced_at`, `last_sync_status`, `last_sync_error` | for admin dash |
| `created_at`, `updated_at` | standard |

**RLS:**
- CM can read/insert/update/delete only their own row (`user_id = auth.uid()`)
- Admins can read all rows (for the admin dash)

Add column to `call_notes`:
- `fireflies_transcript_id text` with unique partial index for dedupe. Existing `source` column already supports `'fireflies'`.

---

## 2. Settings page — `/settings/integrations`

Brand-new page (option A). Adds an "Integrations" entry to the existing Settings nav.

**Notetaker card (per-user view, every CM sees this):**
- **Not connected:** explainer + "Connect Fireflies" button → dialog with API key input + link to `https://app.fireflies.ai/integrations/custom/fireflies`
- **Connected:** Fireflies name/email, last sync time, "Sync now", "Disconnect"

**Admin section (only visible to `admin` role):**
- Table of all CMs (from `auth.users` + `user_roles`) joined to `fireflies_connections`
- Columns: CM name/email, Connected (yes/no), Last sync, Status, Error
- Lets admin see at a glance who still needs to connect

---

## 3. Edge functions

All call Fireflies GraphQL directly at `https://api.fireflies.ai/graphql` with `Authorization: Bearer <cm_api_key>`. JWT-validated against the calling CM.

- **`connect-fireflies`** — validates submitted key via `users { user_id name email }`, upserts row, returns identity
- **`sync-fireflies-meetings`** — accepts optional `user_id`. If provided, syncs that one CM (used by "Sync now" and cron loop). If absent + called by admin, syncs everyone. Pulls `transcripts(fromDate)` since `last_synced_at` (or 30 days back on first connect), fetches detail per transcript, upserts into `call_notes` with `source='fireflies'` and `fireflies_transcript_id` for dedupe. Skips meetings whose title contains "Impromptu" (matching current Fathom rule).
- **`disconnect-fireflies`** — deletes the current user's row

---

## 4. Initial backfill

When a CM connects, `connect-fireflies` triggers an immediate `sync-fireflies-meetings` pass with a 30-day window so they see notes right away.

---

## 5. Scheduled sync — once per day

A pg_cron job runs daily (e.g. 6:00 UTC) that invokes `sync-fireflies-meetings` for every connected CM, looping through `fireflies_connections` and pulling anything newer than `last_synced_at`.

---

## 6. Explicitly NOT in this plan (next phase)

- Turning off the Fathom webhook + `sync-fathom-meetings`
- Speaker/company matching for Fireflies notes (reuse the 7-tier cascade from Fathom)
- Wiring Fireflies notes into Strategy Insights + `rematch-call-notes`
- Removing `FATHOM_API_KEY` and Fathom edge functions
- Migrating historical Fathom rows

Fathom and Fireflies coexist during transition via the `source` column.

---

## Technical appendix

```text
auth.users (CM)
   └── fireflies_connections (1:1)
            │  api_key, last_synced_at
            ▼
   sync-fireflies-meetings ─── Fireflies GraphQL
            │
            ▼ upsert by fireflies_transcript_id
        call_notes  (source='fireflies')

pg_cron (daily) ──► sync-fireflies-meetings (no user_id, loops all CMs)
```

API key storage note: stored in Postgres protected by RLS. Stronger options (pgsodium encryption) can be layered in later if needed.
