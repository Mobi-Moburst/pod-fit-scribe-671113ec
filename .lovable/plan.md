
## What we're building

Add a **Campaigns ↔ Kitcaster Pulse** toggle at the top of `/overview`. "Campaigns" stays as-is (current LTV client view). "Pulse" is a new agency-wide rollup powered by a new `momentum_bookings` table synced from the **Momentum Report** Airtable base (`appxw22m8TBPlq05F`, tables `2025` + `2026`).

## Coverage map of management's list

Already in Overview (Campaigns view):
- Client health, partial CM-vs-goal, partial offboarding-soon, partial bookings-per-client

Easy adds from existing `ltv_snapshots` (no new sync):
- CM bookings vs monthly goal (sum `deliverables_completed_this_month` / `goal_this_month` by CM)
- Total monthly bookings (Kitcaster-wide)
- Total bookings per SME
- Clients leaving this month (`offboarding` + `renewal_date` this month)
- New clients this month (clients first seen in `synced_at` this month — caveat in tech notes)

Need the new Momentum sync (no other source has booking-level dates):
- Last 10 bookings (Kitcaster-wide)
- Last 5 bookings per industry
- Most-booked industry YTD
- Most-booked podcasts all-time
- True calendar-YTD bookings

## Data layer

New table `momentum_bookings`:
- `airtable_record_id` (unique), `year_table` (`2025`/`2026`)
- `campaign_manager`, `client_name`, `podcast_name`, `podcast_url`, `host_name`
- `activity_type` (e.g. "Podcast Recording", "Intro Call")
- `date_secured` (date), `start_date_time` (timestamptz)
- `company_id` (nullable, resolved via fuzzy match against `companies.name` and `ltv_snapshots.client_name`)
- `industry` (denormalized snapshot from matched `companies.industry`)
- `raw_fields` jsonb, `synced_at`, `org_id`
- Indexes on `date_secured`, `campaign_manager`, `industry`, `company_id`
- Standard org-scoped RLS + grants

New edge function `sync-momentum-bookings`:
- Lists tables in base `appxw22m8TBPlq05F`, iterates `2025` and `2026` (and any future year table matching `^\d{4}$`)
- Paginates all records, upserts on `airtable_record_id`
- Resolves `company_id` by matching `Client` against `companies.name` (exact, then normalized lower/trimmed). Caches industry from the matched row.
- Returns `{ upserted, matched_to_companies, by_year }`

Add a `Sync Momentum` button next to the existing `Sync LTV` button (admin-only). Optional: have `sync-ltv-snapshots` trigger the momentum sync as well, so a single click refreshes both.

## UI

`src/pages/Overview.tsx` gets a top toggle (`Campaigns` | `Pulse`). The whole current page stays under `Campaigns`. New `src/components/overview/PulseView.tsx` renders:

1. **Top KPI strip** (6 tiles):
   - Bookings this month · Bookings YTD · New clients this month · Offboarding this month · Active SMEs · Avg fulfillment %
2. **CM leaderboard** card — table of CM, bookings this month, monthly goal (from `ltv_snapshots`), % to goal, YTD bookings. Sorted by % to goal desc.
3. **Industry breakdown** card — top industries by YTD booking count, with sparkline of last 6 months; click an industry → drawer showing last 5 bookings in that industry.
4. **Last 10 bookings** feed — client, podcast, CM, date_secured, podcast link.
5. **Top podcasts all-time** card — podcast_name + count, top 10, normalized by lowercased name.
6. **Per-SME bookings** table — speaker/client, bookings this month, bookings YTD, last booking date.

All cards filter by the same `Campaign Manager` selector that already exists on the page (kept at the top so it applies to both views).

Files touched:
- `src/pages/Overview.tsx` — wrap existing layout, add view toggle
- `src/components/overview/PulseView.tsx` (new)
- `src/components/overview/pulse/CMLeaderboard.tsx` (new)
- `src/components/overview/pulse/IndustryBreakdown.tsx` (new)
- `src/components/overview/pulse/RecentBookings.tsx` (new)
- `src/components/overview/pulse/TopPodcasts.tsx` (new)
- `src/components/overview/pulse/PerSMETable.tsx` (new)
- `supabase/functions/sync-momentum-bookings/index.ts` (new)
- migration: create `momentum_bookings` + RLS + grants

## Open caveats / things to nail down before shipping

- **Industry source of truth.** `companies.industry` is set for some companies but not all, and Momentum's `Client` field is free text. Unmatched bookings will show under "Unknown" until the company is linked. The sync logs unmatched names so we can manually map.
- **"New clients this month"** — neither `ltv_snapshots` nor `companies` has a reliable "campaign start" date. Best proxy is the earliest `date_secured` per `Client` in `momentum_bookings`. Acceptable?
- **What counts as a "booking"?** I'll default to `Type of Activity = "Podcast Recording"` for all counters (matches existing KPI memory). Want me to surface a filter for Intro Call / other activity types?
- **Sync cadence.** Manual button for now. We can wire it to the same cron as LTV (or just trigger both with one button) once you confirm.

## Tech notes

- Migration order: CREATE TABLE → GRANT (`authenticated`, `service_role`) → ENABLE RLS → org-scoped policies (matches existing tables).
- Edge function uses existing `AIRTABLE_PAT` secret — no new connector needed.
- Fuzzy match uses normalized lowercase + strip punctuation; fall back to `ltv_snapshots.client_name` lookup if `companies` doesn't match (the LTV table has more client-name variants).
- Pulse view queries are all `from('momentum_bookings').select(...)` with grouped client-side aggregation; if volume grows past ~5k rows we'll add a `compute-momentum-kpis` cache function mirroring `compute-company-kpis`.

