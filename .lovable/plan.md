## Remaining work to wire up the ticket cache

The table `hubspot_tickets_cache` and the `hubspot-sync-tickets` edge function already exist. Now finish the wiring.

### 1. Rewrite `hubspot-tickets` to read from cache
- Replace the live HubSpot search with a Supabase query against `hubspot_tickets_cache` for the caller's `org_id`.
- Keep the existing response shape so the frontend doesn't change.
- Support the same query params (pipeline filter, search, pagination) but resolve them as SQL filters.
- If the cache is empty for the org, trigger an inline `full` sync once, then return results.

### 2. Update `hubspot-create-ticket` dedupe lookup
- Before calling HubSpot search to check for duplicates, query `hubspot_tickets_cache` first by `kc_shortlist_id` (and `show_url` as fallback).
- Only fall through to live HubSpot search if no cache hit.
- After successful create, insert the new ticket into the cache so it's immediately visible.

### 3. Settings UI: "Sync tickets now" button
- In `HubspotSettingsCard`, add a section showing:
  - Last sync time (max `synced_at` from cache for the org)
  - Row count
  - "Sync now" button that invokes `hubspot-sync-tickets` with `{ mode: 'incremental' }`
  - Optional "Full resync" link that runs `{ mode: 'full' }`
- Show toast on success/failure; refresh stats after sync completes.

### 4. Schedule the cron (10-minute incremental sync)
- Enable `pg_cron` and `pg_net` extensions if not already on.
- Insert (via the DB insert tool, not a migration) a `cron.schedule` that POSTs to `hubspot-sync-tickets` with `{ mode: 'incremental' }` every 10 minutes using the project URL + anon key.

### Out of scope
- Backfilling pre-2026 tickets.
- Two-way sync (changes made in the app pushing back to HubSpot beyond existing create flow).
- Modifying associations logic.