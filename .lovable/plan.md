
# HubSpot → Research integration

Goal: turn the Research workspace into the campaign manager's real-time view of HubSpot's "Agent Master Pipeline" for the selected speaker, with the ability to push shortlisted shows in as new tickets.

## How it works at a glance

```text
[Research / speaker X selected]
          │
          ▼
 ┌─────────────────────────────┐         ┌──────────────────────┐
 │  Edge fn: hubspot-tickets   │ ──────► │  HubSpot CRM v3 API  │
 │  (via connector gateway)    │ ◄────── │  (tickets + pipelines)│
 └─────────────────────────────┘         └──────────────────────┘
          │
          ▼
 ┌─────────────────────────────┐
 │ Research tabs               │
 │  • Discover  (hides shows   │
 │     already a ticket)       │
 │  • Shortlist (+ "Send to    │
 │     HubSpot" button)        │
 │  • Pipeline  ◄── new tab    │
 │     kanban of stages        │
 └─────────────────────────────┘
```

Match rule (confirmed): HubSpot ticket property **`kc_client`** equals **`speaker.name`** exactly (e.g. `Matt Dalio`).
Default new tickets land in **Agent Master Pipeline → Working 1**.

## Phase 1 — Connect HubSpot

1. Use the **HubSpot** connector (gateway-enabled). Trigger the connection picker so an admin links their HubSpot account at the workspace level. After that, `HUBSPOT_API_KEY` is available to edge functions.
2. Add a tiny **discovery edge function** `hubspot-pipelines` (GET) that calls `/crm/v3/pipelines/tickets` and returns the pipelines + stages. We use this once in Settings to confirm we're pointed at "Agent Master Pipeline" and to capture its `pipelineId` + ordered stage IDs/labels.
3. Store the chosen `pipelineId` + cached stage list in a new tiny table `hubspot_settings` (single row per org) so we don't re-fetch on every load and stages stay in the right kanban order.

## Phase 2 — Read pipeline per speaker

New edge function `hubspot-tickets` (GET):
- Input: `speaker_name` (required), optional `pipeline_id` (defaults to stored one).
- Calls **`POST /crm/v3/objects/tickets/search`** with filters: `kc_client EQ <speaker_name>` AND `hs_pipeline EQ <pipelineId>`, plus the properties we need (`subject`, `hs_pipeline`, `hs_pipeline_stage`, `hubspot_owner_id`, `createdate`, `hs_lastmodifieddate`, `hs_ticket_priority`, `closedate`, plus any podcast-link/show-URL custom property if it exists — we'll confirm during phase 1 by reading one ticket).
- Returns tickets grouped by `stage_id` with labels resolved from the cached pipeline.

UI: new **Pipeline** tab in `src/pages/Research.tsx` between Shortlist and the right rail. It renders a compact horizontal kanban (reusing card styling from the current Shortlist rows) with stage columns in HubSpot order: Working 1 → Working 2 → Working 3 → Entered Automation → Emailed Manually → Alternative Outreach → Re-Pitched → Negotiating → Scheduled → Previously Scheduled → Declined → No Response. Each card shows subject, owner avatar/initials, create/last-activity date, priority, and a small "Open in HubSpot ↗" link to `https://app.hubspot.com/contacts/<portalId>/ticket/<id>` (portal ID stored in `hubspot_settings`).

Light caching: tab refresh button + a 60-second SWR cache on the client. No DB mirroring in v1 — keep HubSpot as the source of truth.

## Phase 3 — Dedupe Discover & Shortlist

When a speaker is selected:
- Fetch the same ticket list once and build a normalized **set of show names** (lowercased, trim/strip "the ", trailing "podcast" etc. — same approach we already use in `loadShortlist`).
- In **Discover**: filter out any AI suggestion whose normalized name is in that set.
- In **Shortlist**: hide rows whose normalized show name is in that set (they've graduated to HubSpot — they belong in the Pipeline tab). Keep a small toast/note "N items moved to Pipeline" so nothing feels lost.

## Phase 4 — Send shortlisted show to HubSpot

New edge function `hubspot-create-ticket` (POST):
- Body: `{ shortlist_id }`.
- Server loads the shortlist row + speaker, then calls **`POST /crm/v3/objects/tickets`** with:
  - `subject` = `show_name`
  - `kc_client` = `speaker.name`
  - `hs_pipeline` = stored Agent Master Pipeline id
  - `hs_pipeline_stage` = first stage id ("Working 1")
  - Plus the show URL into whatever custom property we identify in phase 1 (otherwise drop it in `content` as a body note).
- On success: returns the new ticket id, we mark `research_shortlists.status = 'sent_to_hubspot'` and refresh both Pipeline + Shortlist.

UI: add a "**Send to HubSpot**" button on each Shortlist row (next to the existing actions). Disabled state with tooltip if HubSpot isn't connected yet.

## Out of scope for v1 (we can layer in later)

- Moving tickets between stages from inside the command center (full two-way drag/drop).
- Per-CM HubSpot accounts (we use one workspace connection — fine because the property filter already scopes to the right client).
- Writing notes/engagements back to HubSpot.
- Auto-creating a HubSpot ticket on shortlist add.

## Technical details

**New edge functions** (`verify_jwt = false`, validate session in code, never expose `HUBSPOT_API_KEY` client-side):
- `supabase/functions/hubspot-pipelines/index.ts` — GET pipelines.
- `supabase/functions/hubspot-tickets/index.ts` — GET tickets for a speaker.
- `supabase/functions/hubspot-create-ticket/index.ts` — POST new ticket from a shortlist row.

All three hit the gateway base `https://connector-gateway.lovable.dev/hubspot/crm/v3/...` with headers `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${HUBSPOT_API_KEY}`. Zod-validate inputs, return CORS-enabled JSON, and bubble HubSpot error bodies back through.

**New table** `hubspot_settings` (one row per org): `org_id uuid PK`, `portal_id text`, `pipeline_id text`, `stages jsonb` (`[{id,label,order}]`), `kc_client_property text default 'kc_client'`, `show_url_property text null`, timestamps. RLS scoped by `get_team_org_id()`, with the standard four-step CREATE/GRANT/RLS/POLICY block.

**New frontend pieces**:
- `src/lib/hubspot.ts` — typed client wrappers (`getPipeline`, `getSpeakerTickets`, `createTicketFromShortlist`) using `supabase.functions.invoke`.
- `src/components/research/PipelineTab.tsx` — kanban for the selected speaker, plus refresh + empty/error states + "Connect HubSpot" CTA when no settings row exists.
- Update `src/pages/Research.tsx` — add the Pipeline tab, pass the ticket-name set into Discover/Shortlist, and pipe it through `loadShortlist` for filtering.
- Update `src/components/research/ShortlistTab.tsx` — add `Send to HubSpot` action per row.
- Settings: add a small "HubSpot" section to `src/pages/Settings.tsx` that runs the one-time pipeline picker (calls `hubspot-pipelines`, writes `hubspot_settings`).

**Failure modes**: if HubSpot isn't connected, the Pipeline tab and "Send to HubSpot" button render a connect CTA — Discover/Shortlist behave exactly as today (no filtering applied).

