

# Companies Page Redesign: Card-Based Speaker Profiles

## Problem
The current Companies page is a stack of collapsible rows inside collapsible rows. Viewing a speaker's full context requires clicking through multiple nested dropdowns (company expand, then call notes expand, then strategy insights expand). Edit forms render inline as cards that push content around. This discourages browsing and daily interaction.

## New Layout

### Company Level: Grid of Company Cards
- Replace the collapsible list with a **grid of company cards** (2-3 columns on desktop, 1 on mobile)
- Each card shows: logo, company name, campaign manager badge, speaker count, and a row of speaker avatar thumbnails
- Clicking a company card **expands it inline** (full-width, pushes other cards down) to reveal speaker cards inside -- not a tiny collapsible row, but a spacious panel

### Speaker Level: Rich Profile Cards
When a company is expanded, speakers appear as **horizontal cards** with two interaction modes:

**Collapsed (default):** A compact card showing:
- Headshot (or avatar placeholder)
- Name and title
- Top 3 audience tags as badges
- Quick-action icon buttons: Edit, Call Notes, Strategy Insights, Airtable

**Expanded (click the card):** The card expands into a **scrollable profile view** with tabbed sections:

```text
+-----------------------------------------------+
|  [Headshot]  Speaker Name                      |
|              Title at Company        [Edit] [X] |
|                                                 |
|  [Overview] [Strategy] [Call Notes] [Insights]  |
|  ─────────────────────────────────────────────  |
|                                                 |
|  Overview tab:                                  |
|    - Target audiences (badges)                  |
|    - Talking points (bullet list)               |
|    - Things to avoid                            |
|    - Guest identity tags                        |
|    - Competitors list                           |
|    - Media kit link, Airtable link              |
|                                                 |
|  Strategy tab:                                  |
|    - Full campaign strategy (markdown rendered) |
|    - Pitch template (if exists)                 |
|                                                 |
|  Call Notes tab:                                |
|    - CallNotesList component (existing)         |
|                                                 |
|  Insights tab:                                  |
|    - StrategyInsightsPanel (existing)           |
+-----------------------------------------------+
```

### Edit Mode
- Company and speaker edit forms open in a **Sheet (slide-over panel)** from the right instead of rendering inline. This keeps the page context visible and avoids layout shifts.

## Technical Changes

### New Component: `SpeakerProfileCard.tsx`
A new component (`src/components/companies/SpeakerProfileCard.tsx`) that encapsulates the expanded speaker view with tabs (Overview, Strategy, Call Notes, Insights). Reuses existing `CallNotesList` and `StrategyInsightsPanel` components.

### New Component: `CompanyCard.tsx`
A new component (`src/components/companies/CompanyCard.tsx`) that renders the company card with logo, name, CM badge, and speaker thumbnails. Handles expand/collapse.

### Modified: `Companies.tsx`
- Replace the single `Collapsible` list with the new card grid layout
- Move company edit form into a `Sheet` (right slide-over)
- Move speaker edit form into a `Sheet` (right slide-over)
- Wire up the new card components with existing state and CRUD functions

### Files Created
- `src/components/companies/CompanyCard.tsx` -- company card with expand/collapse
- `src/components/companies/SpeakerProfileCard.tsx` -- speaker card with tabbed profile view

### Files Modified
- `src/pages/Companies.tsx` -- replace list layout with card grid, move edit forms to Sheets

### No Backend Changes
All existing data fetching, CRUD operations, and edge function integrations remain unchanged. This is purely a UI restructure.

## Key Design Decisions
- **Tabs over collapsibles**: Each speaker's context (strategy, call notes, insights) lives in tabs within the expanded card rather than stacked collapsibles. One click to switch views.
- **Sheet for editing**: Edit forms slide in from the right, keeping the main page visible so managers don't lose context.
- **Company grid**: Visual scanning is faster with cards than with a flat list of collapsible rows.
- **Speaker headshots prominent**: Headshots appear on the card face, making the page feel more personal and browsable.
- **Existing components reused**: `CallNotesList`, `StrategyInsightsPanel`, `MarkdownRenderer` all slot directly into the new tab views.

