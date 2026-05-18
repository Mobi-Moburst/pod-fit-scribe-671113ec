# Clean up the demo report for prospect-facing use

The current `/demo/report` view exposes internal tooling — visibility toggles, Edit buttons, a "Generate" workflow, and the Avg Fit Score metric we're not using with clients. We'll remove those, drop the Target Podcasts section entirely, and render Content Gap Recommendations as pre-populated, read-only content.

## Changes

### 1. `src/pages/DemoReport.tsx` — make it look like what a client sees
- Remove the Core KPIs and Additional Value Metrics "switch rows" (the toggle controls above each metric grid). Always render the KPI cards directly.
- Remove the **Avg Fit Score** KPI card entirely (and its toggle).
- Remove the `Edit` buttons on Campaign Overview and Next Quarter Strategy, plus the related edit dialogs (`CampaignOverviewEditDialog`, `NextQuarterEditDialog`) and their state.
- Remove the **Target Podcasts for Next Quarter** section in full (card, Generate button, `TargetPodcastsSection`, related state, edge-function call, and imports).
- Replace the **Content Gap Recommendations** card: drop the Generate button and editable `ContentGapRecommendations` component. Render the recommendations inline as read-only cards (same visual treatment used in `DemoPublicReport.tsx` lines 278–310) so the two views match.
- Remove the Interview Highlights "Show" switch — always render when clips exist.
- Strip the now-unused `visibleSections` state, `toggleSection`, `Switch`/`Collapsible` imports, and any dead helpers.
- Keep the top action bar (Back to Demo, Public View, Presentation Mode, Publish) as-is — those are demo navigation, not internal editing.

### 2. `src/pages/DemoPublicReport.tsx` and `src/pages/DemoPresentation.tsx`
- Remove the Avg Fit Score KPI rendering and the `averageScore` field from their visibility prop types/defaults.
- Remove the Target Podcasts rendering block (and `ClientReportTargetPodcasts` import if unused).

### 3. `src/data/demoClients.ts` — pre-populate recommendations
- For each client's `content_gap_analysis`, add an `ai_recommendations` array (3 items each with `title`, `description`, `priority`, `related_topics`) derived from that client's existing `gaps_by_topic` and `priority_prompts` so the read-only card renders out of the box for every demo client.
- Optional: leave `avg_score` in the data (harmless) since nothing renders it after the UI changes.

## Out of scope
- `Showcase.tsx` copy — verified it doesn't mention Avg Fit Score.
- Real (non-demo) report pages — internal tooling stays there for the team.
