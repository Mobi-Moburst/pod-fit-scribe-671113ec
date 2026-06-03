## Goal

Make the Backlogged clients table on Overview actionable. Clicking a row opens a **triage side-panel** that summarizes why the client is behind and offers a one-click jump into Research scoped to the right speaker(s) — without replacing the table or auto-navigating.

## UX flow

```text
Overview › Backlogged clients table
    │  (click row — anywhere except external links)
    ▼
Triage Side-Panel (Sheet, right side)
    ├─ Header: company name + status pill (Backlog / At risk)
    ├─ Why-it's-behind block
    │     • Contracted / mo · Completed · Goal this mo · Gap
    │     • Last booking date (from momentum_bookings)
    │     • Days since last booking
    ├─ Speakers in this company
    │     for each speaker:
    │       • Avatar + name
    │       • Shortlist count (research_shortlists where status active)
    │       • Booked-this-quarter count
    │       • [Research →]  [View profile →]
    └─ Footer actions
          • [Open Research for company] (if 1 speaker → direct deep-link;
             if >1 → focuses the speaker list above)
          • [Close]
```

Clicking **Research →** deep-links to `/research?speaker=<id>` (the route already accepts that param — confirmed in `Research.tsx`).

## What the panel reads

All client-side queries, no new edge functions:

- `companies` + `speakers` — already loaded for the Overview lookup.
- `momentum_bookings` — same source the table already uses; reused to compute "last booking date" per company and "booked this quarter" per speaker.
- `research_shortlists` — count rows per `speaker_id` (status not `rejected`/`booked`) for the "pipeline" line.

These queries fire only when the panel opens, keyed by company name → company id.

## Files to change

- **New:** `src/components/overview/BacklogTriagePanel.tsx`
  - Shadcn `Sheet` (right side, ~`sm:max-w-md`).
  - Props: `companyName`, `row` (the existing backlog row data), `open`, `onOpenChange`.
  - Internally resolves `company_id` from the loaded companies list, fetches speakers + shortlist counts + last booking.
- **Edit:** `src/components/overview/PulseView.tsx`
  - Add `selectedBacklogRow` state.
  - Make `<TableRow>` clickable (`cursor-pointer hover:bg-muted/40`) and set the selected row on click.
  - Render `<BacklogTriagePanel>` once at the bottom of the card.

Table itself stays visually unchanged — no new columns, no colored dots (per your call).

## Out of scope (intentionally deferred)

- Reverse direction (Research showing a "needs attention" workqueue).
- Pipeline-health column / red flag indicators on the table.
- Bulk "open all backlogged in Research".

We can revisit these once the triage panel is in use and we know whether it's enough on its own.

## Technical notes

- Companies are matched to backlog rows by **name** today (the backlog builder works off `ltv_snapshots.client`). The panel will do the same lookup against the already-loaded `companies` list. If no match (legacy client name drift), the panel falls back to a "Couldn't link this client to a company record — open Companies to reconcile" empty state with a link to `/companies`.
- For the "Research →" button on a speaker, link is `/research?speaker=${speaker.id}` — no Research changes needed.
- Panel uses the existing dark-first design tokens, hover-reveal pattern, `text-sm` body type, matching the rest of Overview.
