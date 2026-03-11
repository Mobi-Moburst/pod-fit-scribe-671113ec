

# Improve Airtable Import Matching Against Existing Companies

## Problem
The current matching logic only checks the **second** part of "X - Y" against existing companies (assuming format is always "Speaker - Company"). When Airtable has entries in reverse format like "KIND - Jonathan Schaeffer", the company name "KIND" is in the first position and never gets matched, so it shows up as "new" even though it already exists.

## Solution
Enhance `findExistingCompany` matching to check **both** parts of the parsed string against existing companies, and also check the raw string itself. This way, regardless of whether the entry is "Speaker - Company" or "Company - Speaker", an existing company will be detected.

### File: `src/components/airtable/ImportFromAirtableDialog.tsx`

1. Update `findExistingCompany` to also accept and check the speaker name and raw string:

```typescript
function findExistingCompanyFromParsed(
  parsed: { raw: string; speakerName: string; companyName: string },
  existing: ExistingCompany[]
): ExistingCompany | undefined {
  // Check companyName (standard format), speakerName (reversed format), and raw string
  for (const candidate of [parsed.companyName, parsed.speakerName, parsed.raw]) {
    const lower = candidate.toLowerCase();
    const match = existing.find(c => c.name.toLowerCase() === lower);
    if (match) return match;
  }
  return undefined;
}
```

2. Update all call sites of `findExistingCompany` to use the new function, passing the full parsed object instead of just `companyName`.

3. The `isExisting` check, the auto-select logic, and the import logic all use this function — all will benefit from the improved matching.

