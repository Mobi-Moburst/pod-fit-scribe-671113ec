

# Archive Companies and Speakers

## Approach

Add an `archived_at` timestamp column to both `companies` and `speakers` tables. When set, the entity is considered archived. The Companies page gets a toggle/tab to switch between active and archived views.

## Database Changes

**Migration**: Add `archived_at` column to both tables:
```sql
ALTER TABLE companies ADD COLUMN archived_at timestamptz DEFAULT NULL;
ALTER TABLE speakers ADD COLUMN archived_at timestamptz DEFAULT NULL;
```

`NULL` = active, non-null = archived. No schema changes to RLS needed.

## UI Changes

### `src/pages/Companies.tsx`
- Add `viewMode` state: `'active' | 'archived'`
- Add a tab/toggle bar below the header (or inline) with "Active" and "Archived" tabs
- Filter `companies` by `archived_at IS NULL` for active, `archived_at IS NOT NULL` for archived
- Update `loadData` to fetch `archived_at` from both tables

### Archive/Unarchive Actions
- **CompanyCard**: Add "Archive" action in the expanded action bar (replaces or sits beside Delete). In archived view, show "Restore" instead
- **SpeakerProfileCard**: Add "Archive" action in the hover-reveal actions. In archived view, show "Restore"
- Archive = `UPDATE SET archived_at = now()`, Restore = `UPDATE SET archived_at = NULL`

### Visual Treatment
- Archived companies/speakers shown with reduced opacity or a subtle "Archived" badge
- Archived view is read-only-ish (edit still works but archive actions become "Restore")

## Files
- **Migration**: Add `archived_at` to `companies` and `speakers`
- **Edit**: `src/pages/Companies.tsx` — tab toggle, filter logic, archive/restore handlers
- **Edit**: `src/components/companies/CompanyCard.tsx` — archive/restore button
- **Edit**: `src/components/companies/SpeakerProfileCard.tsx` — archive/restore button
- **Edit**: `src/types/clients.ts` — add `archived_at?: string` to Company and Speaker types

