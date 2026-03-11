

# Fix: Airtable Import Not Detecting Existing Companies

## Problem
Airtable's "Client" column contains combined `"Speaker Name - Company Name"` strings (e.g., `"Aditya Nagrath - Elephant Learning"`), but existing companies are stored by company name only (`"Elephant Learning"`). The current matching does exact string comparison, so nothing matches and all 89 clients appear as "new."

## Root Cause
In `ImportFromAirtableDialog.tsx`, line 42:
```ts
const existingLower = new Set(existingCompanyNames.map(n => n.toLowerCase()));
```
Then checked with `existingLower.has(c.name.toLowerCase())` -- comparing `"aditya nagrath - elephant learning"` against `"elephant learning"`.

## Fix

### 1. Smarter matching in `ImportFromAirtableDialog.tsx`

Add a helper that checks if an Airtable client name matches an existing company by:
1. Exact match (current behavior)
2. If the Airtable name contains ` - `, split and check if the **right-hand side** matches an existing company name
3. Also check if any existing company name is a substring of the Airtable name (handles variations)

This determines the "exists" badge and auto-deselection.

### 2. Smarter import in `ImportFromAirtableDialog.tsx`

When importing a client like `"Aditya Nagrath - Elephant Learning"`:
- If the company part (after ` - `) matches an existing company, **skip creating the company** but still create a speaker named `"Aditya Nagrath"` linked to that existing company
- If no match, create company using the right-hand part as company name and left-hand part as speaker name (instead of using the full combined string as both)

### 3. Update the edge function result display

Show the parsed speaker/company split in the scan results list so users can verify the parsing before import. E.g., show "Aditya Nagrath" with a subtitle "Elephant Learning" instead of the raw combined string.

### 4. Pass existing companies with IDs

The dialog currently receives `existingCompanyNames: string[]`. Change this to pass `existingCompanies: Array<{ id: string; name: string }>` so we can link new speakers to existing company IDs.

## Files Modified
- `src/components/airtable/ImportFromAirtableDialog.tsx` -- matching logic, import logic, display, props
- `src/pages/Companies.tsx` (or wherever the dialog is rendered) -- update prop to pass company objects with IDs

