

# Scrape Campaign Strategy from Media Kit URL

## Summary
Add a "Generate from Media Kit" button next to the Campaign Strategy textarea that scrapes the speaker's media kit page using Firecrawl, then uses the AI gateway to extract structured target audiences and talking points from the scraped content.

## Approach

Two-step pipeline in a single edge function:
1. **Firecrawl scrape** the media kit URL (markdown format) to get page content
2. **AI extraction** via Lovable AI gateway to parse the content into structured target audiences and talking points

This mirrors the existing `fetch-company-brand` pattern but adds an AI step since campaign strategy requires semantic understanding, not just data extraction.

## Changes

### 1. New edge function: `supabase/functions/scrape-campaign-strategy/index.ts`

- Accepts `{ url: string, speaker_name: string, speaker_title: string }`
- Scrapes the media kit URL via Firecrawl (`formats: ['markdown']`, `onlyMainContent: true`)
- Sends the scraped markdown to the AI gateway with a prompt to extract:
  - `target_audiences: string[]` — who this speaker should reach
  - `talking_points: string[]` — key themes/topics they speak about
  - `strategy_summary: string` — a 2-3 sentence positioning summary
- Uses tool calling to return structured JSON
- Returns the structured data to the frontend

### 2. Update `supabase/config.toml`

Add `[functions.scrape-campaign-strategy]` with `verify_jwt = false`.

### 3. Update `src/pages/Companies.tsx`

- Add `isScrapingStrategy` state
- Add `scrapeStrategyFromMediaKit` function that:
  - Invokes `scrape-campaign-strategy` with the speaker's media kit URL, name, and title
  - On success, builds the campaign strategy text using `buildCampaignStrategyFromArrays` (already exists in `src/lib/campaignStrategy.ts`)
  - Updates `editingSpeaker` with the new `campaign_strategy`, `target_audiences`, and `talking_points`
- Add a button next to the Campaign Strategy label: "Generate from Media Kit" with a Sparkles icon
  - Enabled when media kit URL is valid and not already scraping
  - Shows loading spinner while scraping

### UI placement

```text
Campaign Strategy *
[✨ Generate from Media Kit]     ← new button, next to label
┌──────────────────────────────┐
│ Target Audiences:            │
│ - ...                        │
│ Talking Points:              │
│ - ...                        │
└──────────────────────────────┘
```

## Files
- **Create**: `supabase/functions/scrape-campaign-strategy/index.ts`
- **Edit**: `supabase/config.toml` — register new function
- **Edit**: `src/pages/Companies.tsx` — add button and handler

## Notes
- Reuses existing `FIRECRAWL_API_KEY` and `LOVABLE_API_KEY` secrets (both already configured)
- Reuses `buildCampaignStrategyFromArrays` from `src/lib/campaignStrategy.ts` to format the output
- If the textarea already has content, the button will overwrite it (with a confirmation toast or the user can undo)

