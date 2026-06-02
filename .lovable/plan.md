## Update Backlog logic in Kitcaster Pulse

Tighten the backlog threshold and add an at-risk warning so clients show up before they fall fully behind.

### New rules

- **Backlogged** (red): `remaining >= 2 × goal_this_month`
  - i.e. `(total_planned_bookings_by_eom − actual_bookings_to_date) >= 2 × goal_this_month`
  - Goal must be > 0; exclude `offboarding` and `zz_complete` rows (unchanged).
- **At risk** (amber warning tag): mid-month or later AND approaching the 2x threshold
  - `dayOfMonth >= 15`
  - `remaining >= 1.5 × goal_this_month` AND `remaining < 2 × goal_this_month`
  - Shown in the same table, sorted below true backlog rows, with an amber "At risk" badge.

### UI changes (`src/components/overview/PulseView.tsx`)

1. Replace the `.filter((r) => r.goal > 0 && r.remaining >= r.goal)` line so each row gets a `status: "backlog" | "at-risk" | null`; keep only `backlog` and `at-risk` rows.
2. Sort: backlog first (by `remaining` desc), then at-risk (by `remaining` desc).
3. Add a `Status` column (or inline badge next to client name) using existing semantic tokens — red for Backlog, amber for At risk.
4. Update the section subtitle from "Behind by ≥ 1 month of goal" to "Behind by ≥ 2× monthly goal · {backlogCount} backlog · {atRiskCount} at risk".
5. Empty-state copy stays the same when both counts are zero.

No data model, edge function, or business-logic changes outside this component.