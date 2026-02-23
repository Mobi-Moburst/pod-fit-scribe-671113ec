

# Call Notes Strategy Digest

Add an AI-powered "Strategy Insights" panel to each speaker's section on the Companies page. When a campaign manager clicks a button, the system analyzes recent call notes and generates actionable suggestions -- strategy updates, pitch angle ideas, and quarterly notes -- that the manager can review and accept into the speaker's profile.

## How It Works

1. A "Strategy Insights" button (with sparkle icon) appears next to "Call Notes" on each speaker row
2. Clicking it calls a new edge function that reads the speaker's recent call notes + current strategy from the database
3. AI analyzes the call notes and returns structured suggestions
4. Results appear in a collapsible panel with three sections:
   - **Strategy Updates** -- Suggested additions/changes to target audiences and talking points
   - **Pitch Angle Ideas** -- Fresh pitch hooks extracted from client conversations
   - **Quarterly Notes** -- High-level summary of strategic themes and decisions from recent calls
5. Each suggestion has an "Accept" action that applies it (e.g., appends to talking points, updates strategy text)
6. A "Quarterly Notes" section persists as a running log on the speaker record

## Changes

### 1. Database: Add quarterly_notes column to speakers table

Add a `quarterly_notes` JSONB column to store a running log of strategy notes by quarter.

```sql
ALTER TABLE speakers ADD COLUMN quarterly_notes jsonb DEFAULT '[]'::jsonb;
```

Structure: `[{ "quarter": "Q1 2026", "notes": "Client wants to...", "created_at": "..." }, ...]`

### 2. New Edge Function: `analyze-call-notes-strategy`

A new Supabase edge function that:
- Accepts `speaker_id` as input
- Fetches the speaker's profile (strategy, audiences, talking points) and their recent call notes (last 90 days)
- Sends everything to Lovable AI (google/gemini-3-flash-preview) with a structured tool-calling prompt
- Returns three categories of insights:

```typescript
{
  strategy_updates: {
    new_audiences: string[];      // suggested audience additions
    new_talking_points: string[]; // suggested talking point additions
    positioning_shifts: string[]; // broader strategic observations
  };
  pitch_angles: string[];         // 3-5 fresh pitch hooks from call context
  quarterly_summary: string;      // 2-3 sentence high-level quarter summary
}
```

Uses tool calling (like the existing `generate-pitch-hooks` pattern) for reliable structured output.

### 3. New Component: `StrategyInsightsPanel`

A new React component (`src/components/call-notes/StrategyInsightsPanel.tsx`) that:
- Shows a "Generate Insights" button with loading state
- Calls the edge function via `supabase.functions.invoke`
- Renders results in three collapsible sections:
  - **Strategy Updates**: Each suggestion shown as a card with "Add to Strategy" button
  - **Pitch Angles**: List of hooks with "Copy" action
  - **Quarterly Summary**: Preview text with "Save to Notes" button
- On accept actions:
  - "Add to Strategy" appends items to speaker's `target_audiences` or `talking_points` arrays and updates the `campaign_strategy` text
  - "Save to Notes" appends the quarterly summary to the speaker's `quarterly_notes` JSONB array

### 4. UI Integration on Companies Page

- Add a "Strategy Insights" collapsible trigger next to the existing "Call Notes" trigger on each speaker row
- Inside it, render `<StrategyInsightsPanel speakerId={speaker.id} speaker={speaker} onUpdate={loadData} />`
- The panel is on-demand (user clicks to generate) -- no auto-refresh

### 5. Config Update

Add the new edge function to `supabase/config.toml`:
```toml
[functions.analyze-call-notes-strategy]
verify_jwt = false
```

---

## Technical Details

**Files created:**
- `supabase/functions/analyze-call-notes-strategy/index.ts` -- edge function
- `src/components/call-notes/StrategyInsightsPanel.tsx` -- React component

**Files modified:**
- `supabase/config.toml` -- add function config
- `src/pages/Companies.tsx` -- add Strategy Insights collapsible per speaker (next to Call Notes)
- Migration SQL -- add `quarterly_notes` column to speakers

**AI Model:** google/gemini-3-flash-preview (fast, good for structured extraction)

**Key design decisions:**
- On-demand generation (not automatic) to keep campaign managers in control
- Suggestions are advisory -- manager must accept each one before it affects the profile
- Quarterly notes stored as JSONB array for easy append and display
- Uses existing Lovable AI gateway and LOVABLE_API_KEY (already configured)
- Edge function reads directly from Supabase (call_notes + speakers tables) so the client just passes a speaker_id

