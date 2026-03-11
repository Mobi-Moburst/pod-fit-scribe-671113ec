

# Hide Existing Clients in Airtable Import

Simple change: filter out already-existing clients from the displayed list instead of showing them greyed out.

## File: `src/components/airtable/ImportFromAirtableDialog.tsx`

- Change the list rendering to only show `newClients` instead of all `clients`
- Update the summary text to still mention how many already exist (for context), but don't render their rows
- The "All new" checkbox and selection logic already work on `newClients`, so no changes needed there

