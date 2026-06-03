## One-time HubSpot ticket backfill

Goal: pull historical tickets that the original `createdate >= year start` sync missed — specifically scheduled / previously scheduled podcasts for the 29 active clients — into `hubspot_tickets_cache`.

### Filter criteria (confirmed)
- **Stages:** `1366108009`, `1366108010` (you listed `1366108010` twice — I'll treat it as 2 unique stage IDs; if there's a 3rd stage, paste the ID before I run it and I'll add it).
- **Clients:** `kc_client` property must match the name of an active (non-archived) speaker in our DB.
- **Date window:** `createdate >= now() - 24 months` (no upper bound).
- **Pipeline:** the one configured in `hubspot_settings.pipeline_id`.

### Technical plan

1. **Extend `hubspot-sync-tickets`** with a new `mode: 'backfill'` branch that accepts:
   - `stage_ids: string[]` (defaults to the two scheduled stages above)
   - `months_back: number` (defaults to 24)
   - `client_names?: string[]` (optional; if omitted, server loads active speaker names from `speakers` where `archived_at is null`)

   Search loop reuses the existing pagination + 10k-cap handling, but the HubSpot `filterGroups` become:
   ```
   hs_pipeline EQ <pipeline_id>
   createdate GTE <now - 24mo>
   hs_lastmodifieddate GTE <cursor>
   hs_pipeline_stage IN [stage_ids]        // one filterGroup per stage (HubSpot uses OR across groups)
   kc_client IN [client_names]             // chunked into multiple filterGroups if >N names
   ```
   Because HubSpot's search API treats `filterGroups` as OR and `filters` within a group as AND, we'll build a cartesian product: one group per `(stage, client-chunk)` pair. Client names get chunked at ~25 per `IN` clause to stay under HubSpot's per-filter value cap.

   Upserts into `hubspot_tickets_cache` reuse the existing `shapeRow` + chunked upsert path. No stale-delete (backfill is additive only).

2. **Settings UI — new "Backfill historical tickets" action** in `HubspotSettingsCard`:
   - Secondary button under the existing Sync now / Full resync row.
   - Confirmation dialog showing: stage IDs, lookback window, and the count of active speakers that will be matched.
   - On click → invoke `hubspot-sync-tickets` with `{ mode: 'backfill' }`.
   - Toast on completion with `{ synced, pages, duration_ms }`; refresh the cache stats.

3. **Safety**
   - Backfill is idempotent (upsert by `org_id,hubspot_ticket_id`) so it's safe to re-run.
   - No deletes. Existing cache rows stay intact.
   - Logs each filter group so we can verify coverage.

### What I need from you before I build
- Confirm the stage IDs — your message had `1366108010` listed twice. Is the intended set just **two** stages (`1366108009` + `1366108010`), or is there a third I should add?

### Out of scope
- Backfilling pre-24-month tickets.
- Changing the 10-min incremental cron.
- Touching the create-ticket / dedupe flow.
