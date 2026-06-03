# Send to HubSpot — full association flow

Extend the existing "Send to HubSpot" button so it creates (or reuses) a **Company** (the show) and **Contact** (the host) and associates both to the new ticket. Dedupe is driven by the KC backref properties you just created in HubSpot.

## HubSpot properties (already created by you)

| Object  | Internal name                  | Label                              |
|---------|--------------------------------|------------------------------------|
| Ticket  | `kc_shortlist_id`              | KC Command Center Shortlist ID     |
| Ticket  | `kc_source`                    | KC Command Center Source           |
| Contact | `kc_created_for_speaker_id`    | KC Command Center Speaker ID       |
| Contact | `kc_created_by_app`            | KC Command Center Created By       |
| Company | `kc_created_by_app`            | KC Command Center Created By       |
| Company | `kc_show_url`                  | KC Command Center Show URL         |

Constant values written by the app: `kc_source = "command_center"`, `kc_created_by_app = "command_center"`.

## Resolve & create flow (single edge function)

When the user confirms "Send to HubSpot" for a shortlist row:

```text
1. Resolve Company
   a. Search /companies by kc_show_url = row.show_url   → reuse if hit
   b. Else search by domain (parsed from show_url, skip generic hosts)
   c. Else search by exact name
   d. Else CREATE with: name, domain, website, kc_show_url, kc_created_by_app
2. Resolve Contact
   a. If host_email present → search /contacts by email
   b. Else search by kc_created_for_speaker_id = speaker.id AND firstname+lastname
   c. Else CREATE with: firstname, lastname, email?, kc_created_for_speaker_id, kc_created_by_app
      (no hs_lead_status written → stays blank / "--")
3. Dedupe Ticket
   - Search tickets where hs_pipeline = configured AND kc_shortlist_id = row.id
   - If found, skip create and reuse
4. Create Ticket (if not deduped)
   - subject, hs_pipeline, hs_pipeline_stage (stage 1), kc_client = speaker.name,
     kc_shortlist_id = row.id, kc_source = "command_center",
     content = description block, optional show_url_property
5. Associate via /crm/v4/objects/{type}/{id}/associations/default/...
   - ticket ↔ company, ticket ↔ contact, contact ↔ company
6. Stamp our DB: research_shortlists.hubspot_ticket_id / _contact_id / _company_id / _synced_at, status = 'sent-to-hubspot'
```

Generic domains skipped for dedupe (configurable in Settings, preseeded): `apple.com, podcasts.apple.com, spotify.com, youtube.com, substack.com`.

## Confirm-before-send dialog

New `SendToHubspotDialog.tsx` opened from ShortlistTab. Two-step:

1. **Preview** — calls a new `hubspot-resolve-associations` edge function that runs steps 1–3 in dry-run mode and returns: matched-or-new Company, matched-or-new Contact, and whether a duplicate ticket already exists.
2. **Edit & confirm** — user can override host first/last name, host email, and company domain before submitting. Clicking "Create in HubSpot" calls `hubspot-create-ticket` with those overrides.

If a duplicate ticket is detected, the dialog shows "Already in HubSpot — open ticket" instead of a create button.

## Edge function changes

- **New** `hubspot-resolve-associations` — read-only resolve, returns preview JSON.
- **Updated** `hubspot-create-ticket` — accepts optional `overrides: { host_first, host_last, host_email, company_domain }`, runs resolve → create → associate, returns `{ ticket_id, contact_id, company_id, created: { company, contact, ticket } }`.
- **Updated** `hubspot-tickets` — request with `associations=contacts,companies` so existing ticket cards can show primary host + show.

All three use the gateway pattern already in `hubspot-create-ticket` (LOVABLE_API_KEY + HUBSPOT_API_KEY headers).

## Required scopes (you confirmed updated)

`tickets`, `crm.objects.contacts.read/write`, `crm.objects.companies.read/write`, `crm.schemas.contacts.read`, `crm.schemas.companies.read`, `crm.schemas.tickets.read`.

## DB migration

Add to `research_shortlists`:

```sql
ALTER TABLE public.research_shortlists
  ADD COLUMN hubspot_ticket_id text,
  ADD COLUMN hubspot_contact_id text,
  ADD COLUMN hubspot_company_id text,
  ADD COLUMN hubspot_synced_at timestamptz;
```

Add to `hubspot_settings`:

```sql
ALTER TABLE public.hubspot_settings
  ADD COLUMN auto_create_associations boolean NOT NULL DEFAULT true,
  ADD COLUMN generic_domains text[] NOT NULL DEFAULT
    '{apple.com,podcasts.apple.com,spotify.com,youtube.com,substack.com}';
```

No new tables, no new GRANTs needed.

## Settings UI (`HubspotSettingsCard.tsx`)

Add a **"Kitcaster properties"** checklist section showing the 6 properties above with their internal names, plus a small "Verify in HubSpot" button that pings `/properties/{objectType}/{name}` to confirm each exists. If any are missing, show a clear warning with the missing internal name.

Also add:
- Toggle: "Auto-create missing Contacts & Companies" (default on)
- Textarea: "Generic domains to ignore for company dedupe"

## Frontend wiring

- `ShortlistTab.tsx` — replace direct `sendToHubspot()` with opening `SendToHubspotDialog`. Existing dropdown "Send to HubSpot" item opens the same dialog.
- Toast on success links to the created ticket; on dedupe, links to the existing ticket.

## Out of scope

- Updating existing HubSpot entities when our data changes
- Multi-host shows (attach first host only; surface the others in the dialog as read-only)
- Writing engagements/notes beyond the ticket `content` field
- Syncing edits back from HubSpot

Ready to build on approval.