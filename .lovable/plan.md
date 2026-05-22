## Goal

Turn Research into a **speaker-anchored sourcing engine** that surfaces high volumes of niche, guest-accepting podcasts a campaign manager can pitch their client to — plus suggested angles they can paste into their HubSpot templates.

**Hard constraints (per user):**
- Zero Airtable writes. Airtable is for campaign performance data only.
- No pitch "creation" workflow. Drafts and copy live in the dashboard, period.
- Pitch handoff = copy-to-clipboard. CMs paste into existing HubSpot sequence templates.
- Target shape = niche, guest-accepting podcasts that match speaker industry + talking points. Not big shows. Volume game.

---

## Phase 1 — Speaker Workspace + Niche Discovery

**Route**: `/research` becomes the workspace. URL `?speaker=<id>` is shareable.

### Layout
```
┌─ Company → Speaker selector (sticky top)
├─ Left rail (280px): Speaker context
│   • Headshot, name, title
│   • Target audiences (chips)
│   • Top talking points (collapsed)
│   • Already-booked shows count
│   • Strategy snippet (last quarterly note)
├─ Main column
│   • Tabs: [Discover] [Shortlist (N)] [Angles]
└─ Right rail: show detail + angle suggestions (slides in when row clicked)
```

### Discover tab
- "Generate 25 candidates" button (volume, not 5 perfect ones)
- For each candidate, hydrate through Rephonic + iTunes, then apply **two gating filters**:
  1. **Guest filter** — must have a recent track record of guest interviews. Detection signals:
     - Episode titles containing "with [name]" / "ft." / "interview" / "guest" patterns
     - >2 distinct apparent speakers across recent episodes (from titles/descriptions)
     - iTunes/Rephonic category includes Interview-style tags
     - If none of the above are true after sampling 10 recent episodes → drop
  2. **Niche-fit filter** — listener count band. Default 500–50K (tighter than the report-side 1K–100K band; this is the "long tail" research uses).
- Display table columns: cover · show name · host · niche tag · est. listeners · last ep date · guest-cadence badge (e.g. "12/last 15 episodes are interviews")
- **Fit score retuned for niche**:
  - Topic/audience overlap weighted heavily
  - Smaller-but-relevant shows score higher than larger-but-generic ones
  - Penalty applied above the listener-band ceiling (a 200K show is *worse* fit than a 10K show for this use case)
- Already-booked + already-shortlisted shows filtered out
- [Regenerate] · [Generate 25 more] · [Loosen filters] buttons

### Shortlist tab
- Persisted in new `research_shortlists` table (per speaker, org-scoped)
- Per-row states: `new` / `passed` / `pitched-elsewhere` / `booked` (manual marking only — no Airtable sync triggered)
- "Passed" + dismissal reason prevents future resurfacing and feeds back into Gemini prompts ("avoid shows like X because…")
- Bulk re-score button (re-runs fit logic if speaker context changed)

### Angles tab (replaces "Drafts" — no pitch creation, just ideation)
- For any shortlisted show, click "Suggest angles"
- Gemini returns **3–5 distinct pitch angles** the speaker could use *for that show* — not a finished pitch, just the hooks:
  - Each angle = 1-line headline + 1-paragraph "why this works for this show's audience"
  - Tuned to the show's recent episode topics (pulled via Rephonic)
  - Grounded in the speaker's talking points + strategy
- Each angle has **[Copy hook] [Copy full angle]** buttons. That's the entire handoff. CM pastes into HubSpot template.
- No "send" button anywhere. No Airtable. No email integration.

### Evaluate / Batch / History
- Kept reachable from a "Legacy tools" disclosure at the bottom of the left rail. Not removed.

---

## Phase 2 — Smarter sourcing surfaces

Once phase 1 is in production and validated:
- **"More like this"** — pick 2–3 of the speaker's best past bookings, query Rephonic for similar shows, re-apply guest + niche filters
- **Category laddering** — derive seeds from `target_audiences` + booked categories, walk down to sub-niches Rephonic exposes (e.g. "Entrepreneurship" → "Solo Founders" → "Bootstrapped SaaS")
- Both feed the same shortlist with a source filter chip

---

## Phase 3 — Memory & feedback loop (later)

- Dismissal reasons surface back to Gemini as anti-prompts per speaker
- "Pitched elsewhere" / "Booked" states inferred from Airtable sync passively (read-only join, not a write)
- Per-CM "shows I keep finding" surface = highlights niches a CM is over-/under-indexing on

---

## Technical details

**New tables**
```sql
research_shortlists (
  id uuid pk,
  org_id uuid fk,
  speaker_id uuid fk,
  show_name text,
  show_url text,
  itunes_id text,
  rephonic_id text,
  cover_art_url text,
  est_listeners int,
  last_episode_date date,
  guest_cadence_score numeric,   -- 0–1, how often recent eps are guest interviews
  niche_fit_score numeric,        -- retuned scoring
  source text,                    -- 'ai' | 'similar' | 'category'
  status text,                    -- 'new' | 'passed' | 'pitched-elsewhere' | 'booked'
  passed_reason text,
  added_by uuid fk auth.users,
  created_at, updated_at
)

research_angles (
  id uuid pk,
  shortlist_id uuid fk,
  headline text,
  rationale text,                 -- 1-paragraph "why this works"
  created_at
)
```
Standard RLS via `has_role()` + org scoping.

**New edge functions**
- `research-suggest-podcasts` — Gemini suggester + Rephonic/iTunes hydration + guest filter + niche-band filter. Returns up to 25 hydrated candidates per call.
- `research-suggest-angles` — given shortlist row + speaker context + show's recent episode titles, returns 3–5 angle ideas. **No "pitch draft" wording.**

**Removed from previous plan**
- `research-send-to-airtable` — gone
- `research_pitch_drafts` table — gone, replaced with the lighter `research_angles`
- Subject lines, full pitch bodies — gone. Just angle hooks.

**Modified files**
- `src/pages/Research.tsx` (rewrite — workspace shell, speaker selector, tabs)
- `src/components/research/SpeakerContextRail.tsx` (new)
- `src/components/research/DiscoverTab.tsx` (new)
- `src/components/research/ShortlistTab.tsx` (new)
- `src/components/research/AnglesPanel.tsx` (new)

**Reused infra**
- `CompanySpeakerSelector`
- `fetch-rephonic-metrics` (30-day cache)
- `scrape-podcast-cover-art` (iTunes)
- `suggest-target-podcasts` (wrapped with niche filters, not replaced)
- Existing fit-scoring logic (retuned weights)
- Airtable sync used **read-only** for already-booked detection

**Estimate**: 1 migration + 2 edge functions + 4 new components + 1 page rewrite.

---

Ready to build phase 1 on approval.
