## Restructure Integrations page into clickable cards

Move HubSpot config out of Settings and onto the Integrations page, alongside Fireflies, with each integration getting its own clickable detail card.

### New routing

- `/settings/integrations` — index grid of integration cards (overview only)
- `/settings/integrations/hubspot` — HubSpot detail (current `HubspotSettingsCard` body)
- `/settings/integrations/fireflies` — Fireflies detail (current Fireflies card + admin team table)

Each card on the index shows:
- Icon + name
- One-line description
- Connection status badge (Connected / Not connected / Needs config / Error)
- A small status line (e.g. "Last ticket sync: 4 min ago • 312 tickets cached" for HubSpot; "Connected as you@x.com • Last sync 2h ago" for Fireflies)
- Clicking the card navigates to its detail route

### File changes

1. **New `src/components/integrations/IntegrationCard.tsx`** — reusable card: icon, title, description, status badge, status meta line, chevron, wraps a `<Link>`.

2. **New `src/pages/IntegrationDetail.tsx`** with subroutes — or simpler, two new pages:
   - `src/pages/IntegrationHubspot.tsx` — back link → renders `<HubspotSettingsCard />` (admin-gated; non-admins see "Admin only")
   - `src/pages/IntegrationFireflies.tsx` — back link → renders the existing Fireflies card + Team Fireflies Status table (extracted from current `Integrations.tsx`)

3. **Rewrite `src/pages/Integrations.tsx`** as the index page: a responsive 2-column grid of `IntegrationCard`s for HubSpot and Fireflies. Loads minimal status data:
   - HubSpot: `hubspot_settings.pipeline_label` + count/last-sync from `hubspot_tickets_cache` (admin only; for non-admins just show "Admin only" badge)
   - Fireflies: own connection from `fireflies_connections`

4. **`src/pages/Settings.tsx`**: remove `<HubspotSettingsCard />` import + render. Keep the existing Integrations entry card (now points to the new grid).

5. **`src/App.tsx`**: register the two new detail routes under `ProtectedRoute`.

### Out of scope

- No changes to the underlying `HubspotSettingsCard` component or any edge functions.
- No changes to Fireflies sync logic.
- No new connectors yet — structure just makes adding more (Airtable, Rephonic, etc.) trivial later.
