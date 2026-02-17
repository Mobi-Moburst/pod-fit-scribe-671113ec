

# Import Companies from Airtable LTV Table

## Overview
Add an "Import from Airtable" button on the Companies page that pulls client names and campaign managers from your existing LTV table (`appKSO0Fu50JdheHt` / `tblJelP3ssvAGvhYb`) and creates company + speaker placeholder records for any that don't already exist.

## How It Works

1. Click "Import from Airtable" on the Companies page
2. A dialog shows a loading spinner while it fetches names from the LTV table's "Client" column
3. You see a checklist of client names, with already-existing companies greyed out
4. Each entry also shows the Campaign Manager value from Airtable (auto-assigned)
5. Click "Import Selected" -- company + speaker records are created
6. The new companies appear in the main list, ready for you to edit and fill in details (URL, strategy, etc.)

No database schema changes needed. No queue/status column -- just straightforward import of missing clients.

## What Changes

### 1. New Edge Function: `import-airtable-clients`
- Hardcoded to use the shared `AIRTABLE_PAT` secret (already configured)
- Accepts `base_id`, `table_id`, `client_column`, and `campaign_manager_column`
- Fetches all records from the table, extracts unique client names + campaign managers
- Returns `{ clients: [{ name: "...", campaign_manager: "..." }] }`

### 2. New Component: `src/components/airtable/ImportFromAirtableDialog.tsx`
- Dialog with pre-filled Base ID and Table ID from your LTV table
- "Scan" button fetches client names
- Checkbox list with select all/none
- Already-existing company names are shown but disabled
- "Import Selected" batch-creates:
  - One `companies` record per client (name + campaign manager)
  - One `speakers` record per client (same name, linked to the company)
- Shows a summary toast: "Imported 5 new companies"

### 3. Companies Page Update (`src/pages/Companies.tsx`)
- Add an "Import from Airtable" button next to "New Company" in the header
- Wire up the import dialog
- Refresh the company list after import completes

### Technical Notes
- The Base ID (`appKSO0Fu50JdheHt`), Table ID (`tblJelP3ssvAGvhYb`), and column names ("Client", "Campaign Manager") will be pre-filled as defaults in the dialog but remain editable in case you need to point at a different table later
- Edge function registered in `supabase/config.toml` with `verify_jwt = false`
- Deduplication is done client-side by comparing fetched names against existing company names (case-insensitive)

