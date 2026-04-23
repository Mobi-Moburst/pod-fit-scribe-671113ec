

# AEO Audit — Phase 2: Remove CSVs, Manual Toggle, Run History

## 1. Remove GEO + Content Gap CSV uploads

- Remove the GEO CSV and Content Gap CSV slots from `UpdateCSVDialog.tsx` and the report intake flow in `Reports.tsx`.
- Existing reports with CSV-derived data continue to render unchanged — only the upload UI is removed.
- The "Run AEO Audit" button becomes the sole path to populate `geo_analysis` + `content_gap_analysis`.

## 2. Surface AEO Audit as first-class, opt-in

**Report dashboard (`Reports.tsx`):**
- Add `RunAEOAuditButton` (compact) to the report header action row.
- Empty-state CTA in the GEO + Content Gap card areas when data is missing.
- When data exists: "Last run: <timestamp> · Re-run" link on each card.

**Report intake flow:**
- Add an opt-in checkbox: **"Run AEO audit after generating (Haiku, ~$2)"** — default OFF.
- If checked, kick off the audit immediately after report creation; show inline progress.

**Richer prompt context** (carried over from prior unfinished item):
- `RunAEOAuditButton` payload expanded to include `campaign_strategy`, `talking_points`, `professional_credentials`, and competitor names/domains.
- `run-aeo-audit` `generatePrompts()` updated to ground prompts in this context (multi-speaker reports aggregate + dedupe).

## 3. Run history at company level

New table `aeo_audit_runs` for permanent run-over-run snapshots (separate from the 7-day `aeo_audit_cache` dedup table):

```text
aeo_audit_runs
  id, org_id, company_id,
  model, prompts_run, prompts_failed,
  content_gap_analysis jsonb,
  geo_analysis jsonb,
  client_domain, competitor_names text[], topics text[],
  triggered_by uuid, created_at
```

- Edge function inserts one row per successful run with full snapshot + input context.
- New `AEOAuditHistory` component on the **company page** showing all past runs as a timeline (date, model, GEO score, coverage %, top gaps).
- Click a run → side-panel diff vs latest (Δ coverage %, new/closed gaps, competitor movement).
- Once 2+ runs exist for a company, surface "↑ +12% coverage vs last run" badge on GEO + Content Gap cards in the active report.
- Phase 1 = company-level only (multi-speaker reports roll up to the parent company).

## Files touched

- `supabase/functions/run-aeo-audit/index.ts` — INSERT into `aeo_audit_runs` on success; expand prompt context
- `src/components/reports/RunAEOAuditButton.tsx` — pass full client context; emit `last_aeo_audit_at`
- `src/components/reports/UpdateCSVDialog.tsx` — remove GEO + Content Gap CSV slots
- `src/pages/Reports.tsx` — header button, empty-state CTAs, intake checkbox, drop CSV inputs
- `src/pages/Companies.tsx` (+ new `src/components/companies/AEOAuditHistory.tsx`) — timeline + diff viewer
- Migration: create `aeo_audit_runs` table with org-scoped RLS mirroring `aeo_audit_cache`

