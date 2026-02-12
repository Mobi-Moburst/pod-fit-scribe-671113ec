

# Plan: Expand Rephonic CSV Parser to Supply All Podcast Metadata

## Overview
The Rephonic CSV now serves as the primary source for podcast metadata (listeners, reach, categories, etc.) that previously came from the Batch Results CSV. The fit scores come from live scoring via Airtable show notes, but all other podcast data needs to come from the Rephonic CSV.

## What the Rephonic CSV Contains (from your example)

| Column | Maps To | Currently Parsed? |
|--------|---------|-------------------|
| Name | podcast_name | Yes |
| Listeners Per Episode | listeners_per_episode | Yes |
| Monthly Listens | monthly_listens | **No** |
| Social Reach | social_reach | **No** |
| Categories | categories | **No** |
| Apple Podcasts | apple_podcast_link | **No** |
| Description | description (new) | **No** |
| Publisher | publisher (new) | **No** |
| Engagement | engagement (new) | **No** |
| Episode Duration | episode_duration_minutes | Yes |
| EMV | emv | Yes |

## Changes

### 1. Expand `RephonicCSVRow` type (`src/types/csv.ts`)
Add the missing fields to the interface:
- `monthly_listens?: number`
- `social_reach?: number`
- `categories?: string`
- `apple_podcast_link?: string`
- `description?: string`
- `publisher?: string`

### 2. Update `parseRephonicCSV()` (`src/utils/csvParsers.ts`)
Map the new columns from the Rephonic CSV, handling header name variations:
- `monthly_listens` from "Monthly Listens" / "monthly_listens"
- `social_reach` from "Social Reach" / "social_reach"
- `categories` from "Categories" / "categories"
- `apple_podcast_link` from "Apple Podcasts" / "apple_podcasts" / "apple_podcast_link"
- `description` from "Description"
- `publisher` from "Publisher"

### 3. Expand `applyRephonicEMVData()` (`src/utils/reportGenerator.ts`)
Currently this function only applies `listeners_per_episode`, `episode_duration_minutes`, and `emv` from Rephonic data onto merged podcasts. Expand it to also apply:
- `monthly_listens` (if not already set from batch)
- `social_reach` (if not already set)
- `categories` (if not already set)
- `apple_podcast_link` (if not already set)

This way, when reports are generated with live scores (no batch CSV), the Rephonic CSV fills in all the metadata that would have come from the batch CSV.

### 4. Update KPI calculations (`src/utils/reportGenerator.ts`)
Ensure `calculateEnhancedKPIs()` properly sums `monthly_listens` and `social_reach` from the merged podcast entries (it already does this from the `PodcastReportEntry` objects, so this should work automatically once `applyRephonicEMVData` populates those fields).

## Files to Modify

| File | Change |
|------|--------|
| `src/types/csv.ts` | Add `monthly_listens`, `social_reach`, `categories`, `apple_podcast_link`, `description`, `publisher` to `RephonicCSVRow` |
| `src/utils/csvParsers.ts` | Parse new columns in `parseRephonicCSV()` |
| `src/utils/reportGenerator.ts` | Apply new Rephonic fields in `applyRephonicEMVData()` |

## What Stays the Same
- All existing report logic, KPI calculations, and merge logic remain unchanged
- The Batch CSV path still works identically if provided
- EMV calculations from Rephonic data stay the same
- The live scoring flow (from the previous plan) remains intact
