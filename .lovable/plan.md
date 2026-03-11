

## Change

Update the default field mapping for `scheduled_date_time` in `src/components/airtable/AirtableConnectionDialog.tsx` from `"Recording Date"` to `"Scheduled Date / Time"` to match the actual Airtable column name.

**File: `src/components/airtable/AirtableConnectionDialog.tsx` (line 38)**

```tsx
// Before:
scheduled_date_time: 'Recording Date',

// After:
scheduled_date_time: 'Scheduled Date / Time',
```

Single line change. This only affects the default for new connections — existing connections retain their saved mapping.

