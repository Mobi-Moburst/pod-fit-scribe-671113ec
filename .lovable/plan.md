

## Per-Speaker Airtable Connection Clarity

### Problem
When a CM opens the Airtable dialog for a speaker, the hook falls back to the company-level connection if no speaker-specific one exists. The CM sees the company connection's details pre-filled but has no indication whether they're viewing a company-wide connection or a speaker-specific one. Saving creates a new speaker-level connection (correct behavior), but the UX doesn't communicate this. It feels like "only one Airtable" exists.

### Solution
Add clear scope indicators and an intentional "use company connection" vs "set up speaker-specific connection" flow.

### Changes

**1. `src/components/airtable/AirtableConnectionDialog.tsx`**
- Add a scope indicator banner below the "Connected to Airtable" banner:
  - If viewing a **speaker-specific** connection: show "🔗 Connected for {speakerName}" in green
  - If viewing a **company fallback**: show "Using company-wide connection · {connectionName}" in amber/yellow with a button: **"Create speaker-specific connection"** that clears the form for fresh input
  - If **no connection** exists: show nothing (current behavior)
- Pass a new `isCompanyFallback` prop from the hook to distinguish the two states

**2. `src/hooks/use-airtable-connection.ts`**
- Add an `isCompanyFallback` boolean to the return value
- Set it to `true` when `speakerId` was provided but the returned connection has `speaker_id === null` (meaning it fell back to the company-level connection)
- This lets the dialog distinguish "speaker has own connection" from "speaker is using company's connection"

**3. `src/components/airtable/AirtableConnectionDialog.tsx` — dialog title**
- When `speakerId` is provided, show dialog title as "Airtable · {entityName}" so the CM knows which speaker they're configuring

### UI Behavior

```text
Speaker with own connection:
┌──────────────────────────────────┐
│ Airtable · Jim Spignardo         │
│                                  │
│ ✓ Connected to Airtable          │
│   Speaker-specific connection    │
│                                  │
│ [URL / Browse / Fields...]       │
└──────────────────────────────────┘

Speaker using company fallback:
┌──────────────────────────────────┐
│ Airtable · Ben Wilcox            │
│                                  │
│ ⚠ Using company-wide connection  │
│   "ProArch Activity Tracker"     │
│   [Create speaker-specific]      │
│                                  │
│ [URL / Browse / Fields...]       │
└──────────────────────────────────┘
```

When "Create speaker-specific" is clicked, the form clears so the CM can paste a new URL or browse for a different table. Saving will create a new row with `speaker_id` set, leaving the company connection untouched.

### Technical Detail
| File | Change |
|---|---|
| `src/hooks/use-airtable-connection.ts` | Add `isCompanyFallback` to return; set based on whether returned connection's `speaker_id` matches the requested `speakerId` |
| `src/components/airtable/AirtableConnectionDialog.tsx` | Add scope banner with fallback indicator and "Create speaker-specific" action; update dialog title |

