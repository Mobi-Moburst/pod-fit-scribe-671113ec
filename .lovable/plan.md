

# Podchaser API Integration Plan

## Goal
Replace the manual Rephonic CSV upload with an automated Podchaser API integration that fetches `listeners_per_episode` (audienceEstimate), `social_reach` (socialFollowerCounts), `categories`, and `description` for each podcast in a report -- using Apple Podcast URLs already stored in Airtable.

## How It Works Today

1. User uploads a **Rephonic CSV** with columns: `podcast_name`, `listeners_per_episode`, `monthly_listens`, `social_reach`, `categories`, `description`, `publisher`
2. The `parseRephonicCSV()` parser extracts this data
3. `applyRephonicEMVData()` merges it into report podcast entries by title matching
4. KPIs like Total Reach, Social Reach, and EMV are calculated from this enriched data

## What Changes

Instead of requiring a CSV upload, the system will call Podchaser's GraphQL API to fetch metrics for each podcast using the Apple Podcast URL (which is already available from Airtable sync data).

```text
Current Flow:
  Airtable (bookings) + Rephonic CSV (metrics) --> Report

New Flow:
  Airtable (bookings) --> Podchaser API (metrics) --> Report
  (Rephonic CSV remains as optional fallback/override)
```

## Implementation Steps

### 1. Store Podchaser API Credentials as Secrets
- Add two new secrets: `PODCHASER_API_KEY` and `PODCHASER_API_SECRET`
- These are the Client ID and Client Secret from the user's Podchaser app (visible in the screenshot they shared)

### 2. Create `fetch-podchaser-metrics` Edge Function
A new Supabase edge function that:

- **Authenticates** with Podchaser using the `requestAccessToken` mutation (client credentials grant)
- **Accepts** an array of Apple Podcast URLs
- **Extracts** Apple Podcast IDs from the URLs (e.g., `id1234567890` from `https://podcasts.apple.com/us/podcast/.../id1234567890`)
- **Queries** the Podchaser GraphQL API for each podcast using `podcast(identifier: { id: "1234567890", type: APPLE_PODCASTS })`
- **Returns** per-podcast: `audienceEstimate` (monthly listeners), `socialFollowerCounts` (total social reach), `categories`, `description`, `title`

GraphQL query per podcast:
```text
query {
  podcast(identifier: { id: "APPLE_ID", type: APPLE_PODCASTS }) {
    title
    description
    audienceEstimate
    categories { text }
    socialFollowerCounts { totalCount }
  }
}
```

The function will batch lookups (process all URLs in a single call with sequential queries) and return a map of Apple Podcast URL to metrics.

### 3. Create `podcast_metadata_cache` Table
A new database table to cache Podchaser results so we don't re-fetch the same podcast repeatedly (saves API points):

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| apple_podcast_url | text | Unique, indexed |
| podcast_name | text | From Podchaser |
| listeners_per_episode | integer | audienceEstimate |
| monthly_listens | integer | Derived or same as audience |
| social_reach | integer | socialFollowerCounts.totalCount |
| categories | text | Comma-separated |
| description | text | From Podchaser |
| fetched_at | timestamptz | For cache expiry (re-fetch after 30 days) |
| org_id | uuid | For RLS |

### 4. Update Report Generation Flow
In `reportGenerator.ts`:

- Add a new function `fetchPodchaserMetrics(applePodcastUrls: string[])` that:
  1. First checks `podcast_metadata_cache` for cached data (less than 30 days old)
  2. For cache misses, calls the `fetch-podchaser-metrics` edge function
  3. Stores new results in the cache
  4. Returns data in the same `RephonicCSVRow` format so existing merge logic works unchanged

- In `generateMultiCSVReport()` and `generateMultiSpeakerReport()`:
  - After merging Airtable data, collect all Apple Podcast URLs from podcast entries
  - Call `fetchPodchaserMetrics()` to get metrics
  - Apply the data using the existing `applyRephonicEMVData()` function (same format)
  - If a Rephonic CSV was also uploaded, let CSV data override Podchaser data (manual override wins)

### 5. Update Report UI
- Make the "Rephonic CSV" upload field optional (it already is, but clarify in UI text)
- Add a small indicator showing "Podcast metrics: Auto-fetched via Podchaser" or "Podcast metrics: From Rephonic CSV" in the report header or generation dialog
- Keep the Rephonic CSV upload as a manual override option

### 6. Config Updates
- Add `verify_jwt = false` for the new edge function in `supabase/config.toml`

## What Stays the Same
- All existing report types, KPI calculations, EMV formulas, and UI components remain unchanged
- The `RephonicCSVRow` interface and `applyRephonicEMVData()` function are reused as-is
- CSV upload remains available as a fallback/override
- The Rephonic CSV parser stays in the codebase

## Risk Mitigation
- If Podchaser doesn't have a podcast or returns null for `audienceEstimate`, that podcast simply won't have listener data (same as today without a CSV)
- Cache prevents burning through the 25,000 monthly API points
- User can always revert to the current version if Podchaser doesn't work out

