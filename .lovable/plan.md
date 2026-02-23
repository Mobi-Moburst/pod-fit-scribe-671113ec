
# Add Pitch Template as Context for Strategy Insights

## Summary
Include the speaker's `pitch_template` field (when available) as additional context for the AI when generating strategy insights. This gives the model a concrete example of the speaker's voice and positioning, leading to more relevant suggestions.

## Change

**File: `supabase/functions/analyze-call-notes-strategy/index.ts`**

1. Add `pitch_template` to the speaker select query (line ~37):
   ```
   .select("name, title, campaign_strategy, target_audiences, talking_points, avoid, guest_identity_tags, professional_credentials, company_id, pitch_template")
   ```

2. Add a conditional block in the user prompt (around line ~80) that includes the pitch template when it exists:
   ```
   ${speaker.pitch_template ? `\nExample Pitch:\n${speaker.pitch_template}` : ""}
   ```
   This goes after the "Topics to Avoid" line and before the call notes section.

No other files need to change. The frontend component and database schema are unaffected since `pitch_template` already exists on the speakers table.
