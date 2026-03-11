

# Decouple Target Audiences and Talking Points from Campaign Strategy Text

## Problem
When the Campaign Strategy textarea is edited, `parseCampaignStrategy` re-parses the text and **overwrites** `target_audiences` and `talking_points` arrays — destroying any items added via Insights or manual edits.

## Current flow
```text
Edit strategy text → parseCampaignStrategy() → overwrites target_audiences & talking_points arrays
Insights "Accept" → appends to arrays directly
Next strategy text edit → arrays reset from text again (insight additions lost)
```

## Solution
Stop auto-deriving arrays from the strategy text. Instead, give target_audiences and talking_points their own editable inputs in the speaker edit form, and treat campaign_strategy as a separate freeform notes/narrative field.

### Changes to `src/pages/Companies.tsx`

1. **Remove the `parseCampaignStrategy` call** from the Campaign Strategy textarea's `onChange` — just update `campaign_strategy` text without touching the arrays.

2. **Add separate editable fields** for Target Audiences and Talking Points above or below Campaign Strategy in the edit form:
   - Target Audiences: comma-separated textarea (same pattern as "Things to Avoid" and "Guest Identity Tags")
   - Talking Points: comma-separated textarea

3. **Update "Generate from Media Kit"** (`scrapeStrategyFromMediaKit`): instead of building a strategy text blob, populate the three fields independently — set `target_audiences` array, `talking_points` array, and `campaign_strategy` text (for any remaining narrative).

### Changes to `src/lib/campaignStrategy.ts`
- Keep `parseCampaignStrategy` and `buildCampaignStrategyFromArrays` for backward compatibility (used in reports/other places), but they are no longer called on every keystroke in the edit form.

### Strategy tab display (`SpeakerProfileCard.tsx`)
- Currently renders raw `campaign_strategy` text via MarkdownRenderer. Update to show the structured arrays (audiences as badges, talking points as list) followed by any additional strategy narrative — matching what the Overview tab already shows.

### Result
```text
Edit strategy text → only updates campaign_strategy field
Edit audiences → only updates target_audiences array  
Edit talking points → only updates talking_points array
Insights "Accept" → appends to arrays (preserved across edits)
Generate from Media Kit → populates all three independently
```

### Files to edit
- `src/pages/Companies.tsx` — edit form changes, scrape handler update
- `src/components/companies/SpeakerProfileCard.tsx` — Strategy tab rendering

