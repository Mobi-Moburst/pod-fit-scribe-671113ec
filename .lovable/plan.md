Tweaks to the Kitcaster Pulse view to address management's follow-up. All frontend changes inside `src/components/overview/PulseView.tsx` — no schema changes, no new sync.

## What changes

### 1. New "Backlogged clients" table (top of Pulse)
Source: `ltv_snapshots` (already loaded).

Logic: a client is **backlogged** when
`(total_planned_bookings_by_eom − actual_bookings_to_date) ≥ goal_this_month`
(i.e. behind by at least one month's goal), excluding `zz_complete` and offboarding rows.

Columns: Client · CM · Current Bookings (`actual_bookings_to_date`) · Total Podcasts Due (`total_planned_bookings_by_eom`) · Remaining to Book (difference) · monthly Goal. Sorted by largest remaining first. Empty state: "No backlogged clients — everyone on pace."

### 2. New "Total monthly bookings vs deliverables" KPI tile
Replace the `Avg fulfillment` tile (or sit next to it) with `X / Y (Z%)` where:
- X = bookings this month (Momentum, already computed)
- Y = sum of `goal_this_month` across filtered LTV rows
- Color the % using the same green/amber/red thresholds as the CM leaderboard.

### 3. Clients leaving this month → list with name + end date
Today it's just a count tile. Convert the tile to a small card listing each client + `renewal_date` (formatted), with the count as the header. If empty: "None this month."

Filter logic stays the same: `offboarding = true` OR (`renewal_date` within current month AND `renewed != true`).

### 4. New "Bookings per company this month" grid
Card grid (responsive: 2 cols mobile → 4 cols desktop). Each tile shows: company/client name, `this-month count / goal_this_month`, mini progress bar, CM. Sorted by count desc, then alphabetical. Click-through reserved for later.

### 5. New "Bookings per speaker this month" grid
Same visual treatment as #4, but rows are speakers. Resolution rules:
- Load `speakers` (id, name, company_id) once.
- For each `momentum_bookings` row this month, resolve to a speaker via `company_id`:
  - If the company has exactly 1 active speaker → attribute booking to that speaker.
  - If multiple → group under "{Company} — multiple speakers" (one tile, no per-speaker split).
  - If no `company_id` match → bucket as "Unassigned".
- Tile shows: speaker name (or company + "multiple"), this-month count, company name subtitle.

### 6. Keep / minor cleanup
- CM leaderboard (% to goal) already exists — leave as is.
- New clients this month tile — leave as is.
- Client health: leave the Campaigns toggle as the home for it; not duplicating in Pulse.

## Layout order after the change
1. Sync button (top-right, unchanged)
2. KPI strip (6 tiles → swap Avg fulfillment for "Monthly vs deliverable")
3. **Backlogged clients** table (new, full width)
4. CM Leaderboard │ Top industries (unchanged)
5. **Bookings per company — this month** grid (new, full width)
6. **Bookings per speaker — this month** grid (new, full width)
7. Last 10 bookings │ Most-booked podcasts (unchanged)
8. **Clients leaving this month** list (replaces old count tile) │ keep bookings-per-client table next to it

## Out of scope
- No DB migration. No edge function changes. No changes to the Campaigns view.
- Speaker grid is best-effort using existing `speakers` table; rows where Momentum can't match a company stay in "Unassigned" until the Momentum sync's fuzzy match improves.

## Files touched
- `src/components/overview/PulseView.tsx` — add Backlogged table, swap KPI tile, add per-company grid, add per-speaker grid (loads `speakers`), convert offboarding tile to list.