## Goal

Give admins a single place to inspect every meeting that has been synced into `call_notes` (Fireflies + Fathom), see how it was matched (or not), and delete bad ones — so you can diagnose why irrelevant calls are coming through Troy's connection and others.

## Where it lives

New route: `/settings/synced-calls` (admin-only, redirects non-admins).
Entry card added to `src/pages/Settings.tsx` next to the existing "Integrations" card.

## Page layout

**Top bar — filters**
- Source: All / Fireflies / Fathom
- Connected CM (Fireflies owner): dropdown of users from `fireflies_connections` — derived by joining synced rows with the user via the transcript owner. For Fathom, this filter is hidden.
- Match status: All / Matched / Unmatched
- Date range (default: last 30 days)
- Free-text search on `meeting_title` and participant emails

**Summary strip**
- Total synced (in current filter)
- Matched to speaker / company
- Unmatched
- Per-source counts

**Main table** (paginated, 50/page)

| Date | Title | Source | Participants | Duration | Matched Speaker | Matched Company | Actions |
|------|-------|--------|--------------|----------|-----------------|-----------------|---------|

- Row click opens a side panel (Sheet) with: full summary (markdown), action items, participant list with emails/domains, raw transcript ID, and the reasoning fields the matcher would use (title, participant domains, attendee names).
- Row actions: **Delete** (removes the `call_notes` row), **Reassign** (manual speaker/company picker), **Mark as irrelevant** (soft flag — see below).

**Bulk actions**
- Select multiple rows → Delete, or Reassign to a single speaker/company.

## Diagnosing "calls that shouldn't have come through"

Two likely causes the page surfaces:
1. **Wrong scope on Fireflies sync** — we currently pull every transcript visible to the API key. Troy's key may see all Moburst meetings in his Fireflies workspace, not just his own. The participants column makes this obvious at a glance (e.g. no Kitcaster CM in attendees).
2. **No filter on Fireflies group** — you mentioned a "Kitcaster CMs" group in Fireflies. We're not using it.

To support diagnosis without changing sync logic yet, the side panel will clearly show:
- The Fireflies user_id who owns the transcript (the connected CM)
- Whether any participant email matches a known speaker/company domain
- Whether the connected CM was actually in the meeting

This data is enough for you to confirm the root cause before we change the sync filter (which would be a follow-up — likely "only import transcripts where the host = connected user", or filter by Fireflies group ID).

## Soft-delete / irrelevant flag (optional, lightweight)

Add nullable `excluded_at timestamptz` and `excluded_reason text` columns to `call_notes`. "Mark as irrelevant" sets these; Strategy Insights and the rematch function ignore rows where `excluded_at IS NOT NULL`. Hard delete remains available. This lets you triage without losing the audit trail.

## Technical details

- New file: `src/pages/SyncedCalls.tsx`
- New file: `src/components/settings/SyncedCallDetailSheet.tsx`
- Route added in `src/App.tsx` (protected, admin gate via `useUserRole`)
- Entry link in `src/pages/Settings.tsx`
- Migration: add `excluded_at`, `excluded_reason` to `call_notes`
- Reads `call_notes` directly via RLS (org-scoped, already in place); joins `speakers`, `companies`, `fireflies_connections` for display
- Delete/update operations go through existing RLS — admin check enforced client-side + we can add an `is_admin` guard via a new edge function if you'd rather not rely on UI

## Out of scope (for this step)

- Changing Fireflies sync filter logic (group-based, host-only, etc.)
- Auto-matching the 98 existing Fireflies rows to speakers/companies
- Both deferred until you've used this view to confirm the diagnosis
