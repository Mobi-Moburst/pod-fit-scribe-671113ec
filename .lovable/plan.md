

## Simplify Airtable Connection Setup

### Problem
CMs must manually extract Base ID and Table ID from Airtable URLs. This is error-prone and unintuitive.

### Solution: Two improvements

**1. Paste-a-URL parser (front-end only)**
Replace the separate Base ID / Table ID fields with a single "Airtable URL" input at the top. When a CM pastes a full Airtable URL (e.g. `https://airtable.com/appXXX/tblYYY/viwZZZ`), auto-extract `appXXX` and `tblYYY` and populate the fields. Keep the individual fields visible below (read-only when auto-populated, editable if they clear the URL) so CMs can verify or manually override.

URL patterns to handle:
- `airtable.com/appXXX/tblYYY/viwZZZ?...`
- `airtable.com/appXXX/tblYYY`
- `airtable.com/appXXX/shrYYY` (shared view — show warning that this is a view link, not a table)

**2. Browse bases & tables via Airtable Meta API (back-end + front-end)**
Use the Airtable Meta API (`GET /v0/meta/bases` and `GET /v0/meta/bases/{baseId}/tables`) to let CMs pick from dropdowns instead of copying IDs.

- Create a new edge function `list-airtable-bases` that uses the global `AIRTABLE_PAT` to call:
  - `GET https://api.airtable.com/v0/meta/bases` → returns list of bases with names and IDs
  - `GET https://api.airtable.com/v0/meta/bases/{baseId}/tables` → returns tables with names, IDs, and field names
- In the dialog, add a "Browse Airtable" button that fetches bases into a dropdown. Once a base is selected, fetch its tables into a second dropdown. Selecting a table auto-fills Base ID, Table ID, and can even auto-detect field mapping by matching returned field names against our defaults.

### UI Flow (revised dialog)

```text
┌─────────────────────────────────────────┐
│  Connect Airtable                       │
│                                         │
│  Connection Name: [Adam Callinan Act..] │
│                                         │
│  ┌─ Paste Airtable URL ──────────────┐  │
│  │ [https://airtable.com/app.../tbl] │  │
│  │  ✓ Base & Table detected          │  │
│  └───────────────────────────────────┘  │
│                                         │
│  — or —                                 │
│                                         │
│  [Browse Airtable ▼]                    │
│    Base:  [Kitcaster Tracker    ▼]      │
│    Table: [Speaker Activity     ▼]      │
│                                         │
│  Base ID: appXXX  Table ID: tblYYY      │
│  (auto-filled, editable)                │
│                                         │
│  Speaker Column (Optional) [........]   │
│  ▸ Field Mapping (8 fields)             │
│  ▸ Advanced: Custom API Token           │
└─────────────────────────────────────────┘
```

### Technical Changes

| File | Change |
|---|---|
| `supabase/functions/list-airtable-bases/index.ts` | New edge function. Accepts optional `base_id` param. Without it, lists all bases. With it, lists tables for that base (including field names). Uses `AIRTABLE_PAT`. |
| `src/components/airtable/AirtableConnectionDialog.tsx` | Add URL paste input with regex parser. Add "Browse Airtable" mode with base/table dropdowns. Auto-populate Base ID, Table ID, and optionally field mapping from Meta API response. |

### Field Auto-Detection Bonus
When browsing tables, the Meta API returns all field names. We can automatically match them against our `DEFAULT_FIELD_MAPPING` values (e.g., if the table has a field called "Podcast Name", auto-map it). This eliminates the need to touch field mapping for standard bases.

