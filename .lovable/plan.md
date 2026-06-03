## Goal

When the Command Center creates a new Contact or Company in HubSpot, set:
- **Contact owner** = HubSpot owner whose email matches the logged-in app user
- **Company owner** = same (HubSpot owner matched by app user email)
- **Company `kc_show_notes`** = the show description pulled from Rephonic

These only apply on **creation**. If the contact/company already exists in HubSpot, leave it alone.

## Changes

### 1. New helper: resolve HubSpot owner by email
In `supabase/functions/_shared/hubspot-resolve.ts`, add `resolveOwnerIdByEmail(email)`:
- Calls `GET /crm/v3/owners?email={email}` via the connector gateway
- Returns the owner `id` (string) or `null` if no match
- Caches result for the lifetime of the request (one lookup per invocation)

### 2. Pass the caller's email into the resolver
In `supabase/functions/hubspot-create-ticket/index.ts`:
- Read the caller's email from the validated JWT claims (`claims.claims.email`)
- Pass it into `resolveAssociations({ ..., callerEmail })`

Update `ResolveInput` type to include `callerEmail?: string`.

### 3. Set owners on creation only
In `resolveAssociations`:
- Before the company-create branch (`if (!companyId && !dryRun)`) and the contact-create branch, resolve the owner id once via `resolveOwnerIdByEmail(callerEmail)`.
- If found, add `hubspot_owner_id: ownerId` to both `companyWillCreate` and `contactWillCreate`.
- If not found, log a warning and proceed without owner (the rest of the create still succeeds).
- Existing-record branches are untouched — no patch on match.

### 4. Fetch Rephonic show description for new companies
- Reuse the existing `fetch-rephonic-metrics` edge function (already does URL/title/name cascade with caching per the Rephonic Metrics Pipeline memory).
- Confirm it returns a `description` (or equivalent show-about text). If not, extend the function to also surface that field from the Rephonic response. *(I'll verify the exact field name when implementing; if Rephonic doesn't expose it, I'll fall back to the iTunes/podcast metadata description from `scrape-podcast-cover-art` or the row's existing description.)*
- In `resolveAssociations`, only when we're about to **create** a new company, call the fetch function (server-to-server via `supabase.functions.invoke`) using `row.show_url` / `showName`.
- Inject `kc_show_notes: <description>` into `companyWillCreate` when a description is returned. Trim to HubSpot's textarea limit (65,536 chars) defensively.

### 5. Settings checklist update
In `src/components/settings/HubspotSettingsCard.tsx`, add to the Required HubSpot properties list:
- `{ object: 'Company', name: 'kc_show_notes', label: 'KC Command Center Show Notes (multi-line text)' }`

(Owner doesn't need a custom property — `hubspot_owner_id` is a standard HubSpot field.)

### 6. HubSpot connector scopes
The connector token needs **`crm.objects.owners.read`** to look up owners by email. I'll verify the current connection's granted scopes; if missing, I'll trigger a reconnect with that scope.

## Out of scope

- Per-user owner override UI (we're going with email-only matching as you chose).
- Patching owner/show-notes onto already-existing HubSpot records.
- Backfilling owners on tickets/contacts/companies created before this change.

## Open item I'll confirm during build

The exact Rephonic API field for show description. If it isn't already in the cached `podcast_metrics` payload, I'll either extend `fetch-rephonic-metrics` to include it or pull it from the existing `scrape-podcast-cover-art` path that already returns iTunes metadata. Either way, no schema changes needed — `kc_show_notes` lives only in HubSpot.
