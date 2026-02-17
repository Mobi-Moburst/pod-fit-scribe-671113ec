

# Auto-Fetch Peer Comparison Data via Podchaser Credits API

## The Problem
Currently, peer comparison (SOV) requires manually searching for each competitor's podcast appearances, counting them, and entering numbers by hand -- or uploading a CSV. This is tedious and error-prone each quarter.

## What Will Change

### 1. New Edge Function: `fetch-podchaser-credits`
A new Supabase edge function that searches Podchaser's `credits` GraphQL query for a person's podcast guest appearances, filtered by date range.

**Input:**
```json
{
  "competitors": [
    { "name": "Jane Smith", "role": "CEO at Acme" }
  ],
  "date_range": { "start": "2025-10-01", "end": "2025-12-31" }
}
```

**Output:**
```json
{
  "results": {
    "Jane Smith": {
      "interview_count": 7,
      "episodes": [
        { "title": "Episode Title", "podcast_name": "Show Name", "air_date": "2025-11-15" }
      ]
    }
  }
}
```

**How it works:**
- Reuses the existing Podchaser auth flow (same `PODCHASER_API_KEY` and `PODCHASER_API_SECRET` secrets already configured)
- Uses the `credits` query with `searchTerm` to find guest appearances by name
- Filters `episodeCredits` by `airDate` within the report date range
- Returns both the count and episode details for transparency

### 2. "Auto-Fetch" Button in the Peer Comparison UI
Replace the current manual entry workflow with an automated option:

- Add an **"Auto-Fetch via Podchaser"** button next to the Peer Comparison section header
- When clicked, it calls the new edge function with all competitor names and the selected date range
- Auto-populates the interview count fields for each competitor
- Shows a loading state while fetching
- Manual override remains available -- users can still edit counts after auto-fetch or upload a CSV

### 3. Fallback Hierarchy
The system will use this priority:
1. **Manual entry** -- if the user edits a count after auto-fetch, that value sticks
2. **Podchaser auto-fetch** -- new default for populating counts
3. **CSV upload** -- still available as a fallback option

### 4. Error Handling
- If Podchaser `credits` query is not available on the current plan, show a clear message: "Credits API not available -- use manual entry or CSV"
- If a competitor name returns no results, set count to 0 with a note
- Individual competitor failures don't block others

## Technical Details

### New file: `supabase/functions/fetch-podchaser-credits/index.ts`
- Reuse the `getAccessToken()` pattern from `fetch-podchaser-metrics`
- GraphQL query:
```graphql
query SearchCredits($name: String!) {
  credits(
    searchTerm: $name
    first: 100
    filters: { isClaimed: false }
  ) {
    paginatorInfo { total }
    data {
      episode {
        title
        airDate
        podcast { title }
      }
      role
    }
  }
}
```
- Filter episodes where `airDate` falls within the provided date range
- Add to `supabase/config.toml` with `verify_jwt = false`

### Changes to `src/pages/Reports.tsx`
- Add state: `isFetchingSOV` (boolean) and `sovFetchError` (string | null)
- Add an "Auto-Fetch" button in the peer comparison section (lines 2164-2224)
- On click, call the edge function, then update `competitorInterviews` state with returned counts
- Badge updates to show "Auto-Fetched" when data comes from Podchaser

### Changes to `src/utils/reportGenerator.ts`
- No changes needed -- the existing `manualCompetitors` path already accepts `{ name, role, count }` which is exactly what the auto-fetched data produces

### Important Caveat
The Podchaser `credits` endpoint may require a specific plan tier. The edge function will attempt the query and gracefully fall back with a clear error message if access is denied, so the existing manual workflow remains fully functional.
