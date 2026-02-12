

# Fix EMV Metric Mapping from Rephonic CSV

## Problem

The EMV (Earned Media Value) metric shows as 0 because of two compounding issues:

1. **Episode duration not being parsed from Rephonic CSV**: The CSV header "Episode Duration" normalizes to `episode_duration`, but the parser only checks for `episode_duration_minutes` -- missing the match
2. **EMV calculation requires both listeners AND duration**: The `calculateEMV()` function needs `listeners_per_episode` and `episode_duration_minutes` to compute EMV. Since duration isn't parsed, EMV can't be calculated even though listener data is present

## How EMV Was Calculated Before (Working Flow)

The original flow was:
1. Merge batch + Airtable data (batch CSV had listener data)
2. Scrape episode durations from episode links
3. Calculate EMV = (listeners/1000) x CPM x (duration x 0.40)
4. Rephonic CSV applied as supplemental override

Now with the new Airtable-only flow:
1. Airtable stubs have no episode links, so duration scraping returns nothing
2. Rephonic CSV has the duration data but it's not being parsed due to the header mismatch
3. Result: no duration data anywhere, so EMV can't be calculated

## Changes

### 1. Fix Rephonic CSV Duration Parsing (`src/utils/csvParsers.ts`)

Add `episode_duration` as a header variation in the parser (line ~352):

```
const durationRaw = row.episode_duration_minutes || row.episode_duration || 
                    row.duration || row.avg_duration || row.episode_length || row.length || '';
```

### 2. Ensure Rephonic Data Overrides Even When Values Exist (`src/utils/reportGenerator.ts`)

In `applyRephonicEMVData()`, the current logic skips applying Rephonic data if the podcast already has a value (e.g., `!podcast.listeners_per_episode`). For stub entries from Airtable, values default to 0 which is falsy, so this works. But the `episode_duration_minutes` check at line 1569 should also apply when the existing value is 0:

```typescript
// Apply duration if provided by Rephonic (override 0 values too)
if (rephonicData.episode_duration_minutes && !podcast.episode_duration_minutes) {
```
This already works since 0 is falsy. No change needed here -- just the parser fix.

### 3. Recalculate EMV After Rephonic Data Is Applied (`src/utils/reportGenerator.ts`)

After applying Rephonic data (which now includes duration), ensure EMV is recalculated for podcasts that gained both listeners and duration from Rephonic. The existing code at lines 1604-1608 already does this:

```typescript
else if (updatedPodcast.listeners_per_episode && updatedPodcast.episode_duration_minutes) {
  const emvData = calculateEMV(updatedPodcast, cpm);
  if (emvData) Object.assign(updatedPodcast, emvData);
}
```

This will now fire correctly once `episode_duration_minutes` is properly parsed from the CSV.

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/csvParsers.ts` | Add `episode_duration` to the duration header variations (~1 line) |

## Summary

This is a one-line fix. The Rephonic CSV column "Episode Duration" normalizes to `episode_duration` but the parser only checks `episode_duration_minutes`. Adding `row.episode_duration` to the fallback chain will allow duration data to be parsed, which unblocks the EMV calculation formula that already exists downstream.

