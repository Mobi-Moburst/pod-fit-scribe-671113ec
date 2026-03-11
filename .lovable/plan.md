

# Filter Out Clients Without Campaign Manager from Airtable Import

## Problem
Clients without a campaign manager assigned are still in planning mode and shouldn't be available for import.

## Change

### File: `src/components/airtable/ImportFromAirtableDialog.tsx`

After parsing the fetched clients (~line 97), filter out any entries where `campaign_manager` is empty/missing before setting state:

```typescript
const parsed = fetched
  .filter(c => c.campaign_manager && c.campaign_manager.trim() !== '')
  .map(c => ({ ... }));
```

This single filter ensures clients without a CM never appear in the scan results at all.

