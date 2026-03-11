

## EMV Campaign Overview: Data-Driven Strategy & Talking Points

### Problem
1. **Strategy paragraph** uses only speaker profile data (audiences, talking points from profile). It doesn't reference actual quarterly activity — the shows booked, show notes, episode titles, categories.
2. **Key talking points** in Campaign Overview are pulled verbatim from the speaker profile (`client.talking_points?.slice(0, 3)`), not derived from what actually happened that quarter.
3. **Pitch hooks intro copy** says "Each campaign leaned into clearly defined, repeatable hooks..." — not podcast guesting language.

### Changes

#### 1. AI-generate the strategy paragraph using quarterly data
Replace the template-based `generateStrategyParagraph()` with an AI call that receives:
- Speaker profile (name, title, company, audiences, talking points, credentials)
- Quarterly podcast data: podcast names, show notes, episode titles, categories from booked/published episodes
- KPIs (total booked, published, reach, top categories)
- Quarter context

Create a new edge function `generate-campaign-overview` that produces:
- A 2-3 sentence strategy paragraph grounded in what actually happened
- 3 key talking points derived from the intersection of speaker expertise and actual show content

**Files**: `supabase/functions/generate-campaign-overview/index.ts` (new), `src/utils/reportGenerator.ts`

#### 2. Replace static talking points with AI-derived ones
Instead of `client.talking_points?.slice(0, 3)`, use the talking points returned by the new `generate-campaign-overview` function. These will reflect themes that actually surfaced across the quarter's podcast appearances, cross-referenced with the speaker's profile.

**File**: `src/utils/reportGenerator.ts` (line ~1947)

#### 3. Fix pitch hooks intro copy
Update the hardcoded copy in three files:
- `src/components/reports/CampaignOverview.tsx` line 100: Change to "Each placement was positioned to resonate with the show's unique audience:"
- `src/components/client-report/ClientReportCampaignOverview.tsx` line 41: Same update
- `src/components/client-report/slides/CampaignOverviewSlide.tsx` — no hardcoded intro here (just section title), no change needed

#### 4. Update config.toml
Add the new edge function with `verify_jwt = false`.

### Edge Function Prompt Design (`generate-campaign-overview`)
The AI will receive:
- Speaker profile context
- List of booked podcasts with: title, show notes (truncated), categories, episode link titles
- KPIs summary
- Quarter string

It returns JSON: `{ strategy: string, talking_points: string[] }`

The strategy paragraph will read naturally — e.g., "This quarter, [Name] appeared across [N] podcasts spanning [categories], positioning [pronoun] expertise in [topics] to audiences of [audience types]. Conversations centered on [themes from show notes]..."

The talking points will be 3 concise themes actually discussed across appearances, not just profile bullet points.

### Fallback
If the AI call fails, fall back to the existing template-based `generateStrategyParagraph()` and `client.talking_points?.slice(0, 3)`.

