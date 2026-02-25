

# Reports Page Visual Polish: Match Companies Page Aesthetic

## Summary
Apply the same "premium internal tool" design language from the Companies page redesign to the Reports page. The changes target surface treatments, typography hierarchy, KPI cards, section headers, and the saved reports table -- making them calmer, tighter, and more refined.

## Changes

### 1. KPICard.tsx -- Refined surface and spacing

**Current**: Uses the default `<Card>` component with `p-6` padding, `text-3xl font-bold` value, and `bg-primary/10` icon circle.

**Updated**:
- Card surface: explicit `bg-card border border-border/60 hover:shadow-md hover:border-border` (matching CompanyCard pattern) instead of relying on the default Card shadow
- Tighter padding: `p-4` instead of `p-6`
- Value typography: `text-2xl font-bold tracking-tight` (slightly smaller, tighter)
- Icon circle: `bg-muted/60` instead of `bg-primary/10`, icon color `text-muted-foreground` instead of `text-primary` -- calmer, less colorful
- Hide button: already has hover-reveal, no change needed
- Clickable cards: keep `hover:shadow-md` but remove `hover:scale-[1.02]` (the scale transform feels SaaS-template-y)

### 2. Reports.tsx -- Section headers and layout

**Section headers** ("Core KPIs", "Additional Value Metrics"):
- Change from `text-lg font-semibold` with colored icon to `text-sm font-medium uppercase tracking-wide text-muted-foreground` -- a quieter label style, no icon. This matches how Stripe labels dashboard sections.

**All Saved Reports card** (lines 1631-1832):
- Replace `<Card>` wrapper with the same flat surface treatment: `rounded-xl border border-border/60 bg-card`
- CardTitle: `text-[15px] font-semibold tracking-tight` (matching company card name style)
- Table action buttons: make View, Highlights, Update, Publish smaller and quieter -- `variant="ghost"` with `text-xs` instead of `variant="outline"` with full borders. Delete button gets hover-reveal via the table row `group` pattern.

**Generate Report card** (lines 1837-2346):
- Same flat surface treatment on the card
- CardTitle: `text-[15px] font-semibold tracking-tight`
- File upload labels and badges: muted pill style for badges (`bg-secondary text-muted-foreground border border-border` instead of colorful variants)

**Save Report card** (lines 2352-2385):
- Same surface refinement

**Report content sections** (Campaign Overview, Interview Highlights, Top Categories, Next Quarter, etc.):
- These already use `<Card className="group relative">` -- update to add `border-border/60` for the subtler border treatment
- Section hide buttons (the X) are already hover-reveal -- no change

### 3. SpeakerAccordion.tsx -- Calmer accordion treatment

- Section header: `text-sm font-medium uppercase tracking-wide text-muted-foreground` (no icon)
- Accordion item border: `border-border/60` instead of `border`
- Inner KPI mini-cards: already using `bg-muted/30`, keep as-is (they're already calm)
- Trigger badges (booked/published pills): muted style -- `bg-secondary text-muted-foreground` instead of `bg-primary/10` and `bg-accent/10`

### 4. ReportHeader.tsx -- Quick check

- Keep existing layout but ensure it uses the same border/surface patterns

## Files Modified
- `src/components/reports/KPICard.tsx` -- surface, padding, typography, icon treatment
- `src/pages/Reports.tsx` -- section headers, card surfaces, table action buttons
- `src/components/reports/SpeakerAccordion.tsx` -- header style, accordion borders, badge colors

## No Functionality Changes
All click handlers, dialogs, CRUD operations, visibility toggles, and data flow remain identical. This is purely a className/styling refactor.

