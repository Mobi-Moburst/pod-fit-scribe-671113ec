

# Improve Fuzzy Company Name Matching in Airtable Import

## Problem
"Indeed Flex" (Airtable) doesn't match "IndeedFlex" (DB) because of the space. "Moburst Speakers" doesn't match "Moburst" because of the extra word. Current matching is exact (case-insensitive only).

## Solution
Add a `normalize` function and a fuzzy containment check to `findExistingCompanyFromParsed`:

### File: `src/components/airtable/ImportFromAirtableDialog.tsx`

Update the matching function to:

1. **Normalize** both strings: lowercase, strip spaces/punctuation — so "Indeed Flex" → "indeedflex" matches "IndeedFlex" → "indeedflex"
2. **Containment check**: if normalized candidate contains or is contained by the normalized company name (with a minimum length threshold to avoid false positives) — so "moburst speakers" contains "moburst"

```typescript
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.]+/g, '');
}

function fuzzyMatch(candidate: string, existing: string): boolean {
  const a = normalize(candidate);
  const b = normalize(existing);
  if (a === b) return true;
  // Containment: shorter must be ≥4 chars to avoid false positives
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 4 && longer.includes(shorter);
}
```

Then update `findExistingCompanyFromParsed` to use `fuzzyMatch` instead of exact equality.

