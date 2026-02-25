

# Reports Intake Form Redesign: Reduce Dropdown Friction

## Problem
The "Generate Client Report" form is a long vertical stack of dropdowns, file inputs, collapsibles, and badges. Selecting a company requires a dropdown, then a speaker dropdown, then year dropdown, then quarter dropdown, then expanding collapsibles for CSV uploads. Every step feels like a form field rather than a guided flow. This discourages daily use.

## New Approach: Stepped Visual Selection

Replace the monolithic form with a progressive, visual intake flow. Each section reveals only after the previous one is completed, keeping the interface focused. Company and speaker selection become clickable cards rather than dropdowns. Date selection becomes inline button groups rather than Select components.

### Section 1: Company Selection -- Clickable Card Grid

Replace the `CompanySpeakerSelector` combobox with a searchable grid of company cards (similar to the Companies page cards but smaller). Each card shows company name and speaker count. Clicking one selects it (highlighted border). A search input at the top filters the list.

```text
  [Search companies...]

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  Acme Corp   │  │  SignalForge  │  │  AtlasBridge │
  │  2 speakers  │  │  1 speaker    │  │  3 speakers  │
  └──────────────┘  └──────────────┘  └──────────────┘
```

When a company is selected, the card stays highlighted and speakers appear below it.

### Section 2: Speaker Selection -- Inline Chips / Rows

Once a company is selected, speakers appear as clickable rows (single-speaker mode) or checkbox rows (multi-speaker mode) directly below -- no dropdown. Each row shows name, title, and a headshot thumbnail if available.

The multi-speaker toggle stays as a Switch but is inline with the speaker list header.

### Section 3: Report Period -- Button Group Instead of Dropdowns

Replace the Year and Quarter `<Select>` dropdowns with inline button groups:

```text
  Year:     [2025]  [2026]  [2027]
  Quarter:  [Q1]  [Q2]  [Q3]  [Q4]  [Custom]
```

These are `ToggleGroup` components -- one click to select, no dropdown opening/closing. The "Custom" option reveals date inputs inline (same as current behavior).

### Section 4: Data Sources -- Collapsible "Advanced" Section

The CSV upload section (Rephonic, Airtable sync, GEO, Content Gap, Peer Comparison) collapses into a single "Data Sources" section that auto-expands only when needed. The Airtable sync button becomes the primary action (prominent), with CSV upload as a quiet fallback.

For multi-speaker mode, per-speaker data sections use a compact accordion with status indicators (green dot = ready, gray = pending).

### Section 5: Generate Button

Same as current, but now it sits at the bottom of a shorter, cleaner form.

## Technical Changes

### Modified: `src/pages/Reports.tsx` (Generate Report section only, lines ~1842-2352)

- Replace `CompanySpeakerSelector` combobox usage with inline company card grid + speaker row selection
- Replace Year/Quarter `<Select>` components with `ToggleGroup` button groups
- Wrap CSV uploads in a collapsible "Data Sources" section
- Add search input for company filtering
- Keep all state variables and handlers identical -- only the rendering changes

### Modified: `src/components/CompanySpeakerSelector.tsx`

This component is no longer needed for the Reports page (it may still be used elsewhere). No deletion, but Reports.tsx will stop importing it for the generate form.

### No new files needed

All changes are within the existing Reports.tsx generate section. The ToggleGroup component (`@/components/ui/toggle-group`) already exists in the project.

## What stays the same

- All state management, CRUD operations, CSV parsing, report generation logic
- The saved reports table section
- The report display section
- Multi-speaker mode logic (toggle, checkboxes, per-speaker files)
- Airtable sync integration
- Peer comparison auto-fetch

## Key Design Decisions

- **Cards over comboboxes** for company selection: When there are <20 companies (typical), a visual grid is faster than open-dropdown-type-search-select. A search input handles scale.
- **Toggle groups over dropdowns** for year/quarter: These are small, fixed option sets (3 years, 5 quarter options). Dropdowns add unnecessary clicks for a known set of choices.
- **Progressive disclosure**: Data sources section defaults collapsed since Airtable sync handles most cases automatically. Power users expand when needed.
- **Consistent with Companies page**: The selection cards echo the CompanyCard grid pattern, creating visual coherence across the app.

