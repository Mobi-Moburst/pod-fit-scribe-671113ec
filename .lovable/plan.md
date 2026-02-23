
# Companies Page Visual Polish: Premium Internal Tool Aesthetic

## Summary
Refine the visual design of CompanyCard and SpeakerProfileCard to feel like a premium internal tool (Folk CRM / Stripe dashboard style) -- calmer surfaces, tighter spacing, hover-reveal actions, and cleaner typography hierarchy.

## Changes

### 1. CompanyCard.tsx -- Surface and hover treatment

**Card surface**: Replace `card-surface` (which applies `--shadow-elevated`, a colored glow) with a flat, quiet style:
- Light: `bg-zinc-50/80 border border-zinc-200` with no shadow
- Dark: keep `bg-card border-border`
- On hover (collapsed only): add a gentle lift shadow (`shadow-md`) instead of a ring color change
- Expanded state: subtle `shadow-sm` instead of `ring-1 ring-primary/30`

**Typography hierarchy**:
- Company name: `font-semibold text-[15px] tracking-tight` (slightly larger, tighter)
- Speaker count badge: switch to plain text -- `text-xs text-muted-foreground` instead of a Badge component. Just render as `{count} speakers` inline.

**CM badge**: Replace the colorful `cmColor()` hash-based palette with a single muted pill:
- `bg-secondary text-muted-foreground text-[11px] font-medium border border-border`
- Remove the `cmColor` function entirely

**Avatar stack**: Tighter overlap (`-space-x-2.5`), white ring border (`ring-2 ring-background`), slightly smaller `w-7 h-7`

**Action buttons (expanded state)**: Replace the always-visible action bar with a `group-hover` pattern:
- Move Add Speaker, Edit, Airtable, Delete to the card header row, right-aligned
- Use `opacity-0 group-hover:opacity-100 transition-opacity` so they appear only on hover
- All buttons become `variant="ghost"` with small icon-only or text style
- Delete stays `text-destructive` but also hover-only

**Expanded speaker area**: Remove the `bg-muted/20 border-b` action bar wrapper. The speaker list gets `divide-y divide-border/40` instead of `space-y-3` with card wrappers per speaker.

### 2. SpeakerProfileCard.tsx -- Collapsed row refinement

**Collapsed state**: Replace the Card wrapper with a simple `div` row:
- No card border or background -- just a row in the divide-y list
- `py-3 px-1` padding, flex layout
- On hover: `bg-muted/30 rounded-lg` subtle highlight
- Remove the `ChevronRight` icon (the whole row is clickable, cursor-pointer is enough)

**Expanded state**: Keep the tabbed card but refine:
- Remove `ring-1 ring-primary/20` -- use `shadow-sm border border-border` instead
- Header padding tightened to `p-3`
- Action buttons in header: `opacity-0 group-hover:opacity-100` pattern (Edit, Airtable, Delete appear on hover of the header area)
- Keep the close (X) button always visible

### 3. index.css -- Card surface utility update

Update `.card-surface` to be calmer:
- Remove `box-shadow: var(--shadow-elevated)` (the cyan glow)
- Replace with `box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.04)`
- Remove the `:hover { transform: translateY(-1px) }` (we handle hover per-component now)

---

## Technical Details

### Files modified:
- `src/components/companies/CompanyCard.tsx` -- surface classes, remove cmColor, hover-reveal actions, divider-based speaker list
- `src/components/companies/SpeakerProfileCard.tsx` -- collapsed row as plain div, expanded card refinements, hover-reveal actions
- `src/index.css` -- tone down `.card-surface` utility

### No functionality changes
All click handlers, CRUD operations, AlertDialog confirmations, Sheet edit forms, and data flow remain identical. This is purely a CSS/className refactor.
