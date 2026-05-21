## Disconnect Fathom from the platform

Remove the Fathom call-notes integration end-to-end so it no longer appears in the dashboard or syncs data.

### Scope

1. **UI removal**
   - Remove the Fathom connection card/section from `/settings/synced-calls` (and any other settings surface that shows it).
   - Remove Fathom from any sync source filters, badges, or labels in the Synced Calls dashboard.
   - Remove Fathom-specific navigation, buttons, and "Connect Fathom" flows.

2. **Edge functions**
   - Delete Fathom-related edge functions (e.g. `sync-fathom-*`, `connect-fathom`, any webhook handlers).

3. **Secrets**
   - Delete the `FATHOM_API_KEY` secret.

4. **Data cleanup (migration)**
   - Delete existing `call_notes` rows where `source = 'fathom'`.
   - Drop any Fathom-specific connection table/rows (e.g. `fathom_connections` if present).
   - Leave Fireflies data and schema untouched.

5. **Code cleanup**
   - Remove Fathom types, helpers, and references from frontend hooks/components.
   - Keep Fireflies sync logic intact.

### Out of scope
- No changes to Fireflies sync behavior.
- No schema changes to `call_notes` beyond deleting Fathom rows (the `source` column stays so Fireflies keeps working).

Confirm and I'll execute.
