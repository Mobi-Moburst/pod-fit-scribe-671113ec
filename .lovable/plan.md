## Goal

Reduce the top navigation to three tabs — **Companies**, **Research**, **Reports** — and move Evaluate, Batch, and History into a Research workspace where they're listed on the left and open in a modal/pop-up.

## Top navigation changes (`src/components/layout/Navbar.tsx`)

Replace the current five-tab array with:
- Companies → `/companies`
- Research → `/research`
- Reports → `/reports`

Keep the logo, theme toggle, settings, and sign-out controls as they are.

## New Research page (`src/pages/Research.tsx`, route `/research`)

Layout:
```text
┌─────────────────────────────────────────────────┐
│  Navbar                                         │
├──────────────┬──────────────────────────────────┤
│ Research     │                                  │
│ ───────────  │   (empty state / intro copy)     │
│ • Evaluate   │                                  │
│ • Batch      │                                  │
│ • History    │                                  │
└──────────────┴──────────────────────────────────┘
```

- Left rail: vertical list of the three tools with icon + label + short description.
- Clicking a tool opens a large modal (shadcn `Dialog` at `max-w-7xl`, near-fullscreen height with internal scroll) that renders the existing page component inside.
- Right side shows intro/empty state when no tool is open.
- Add a protected route entry in `src/App.tsx` for `/research`.

## Reusing existing pages inside the modal

The current `Evaluate`, `Batch`, and `History` pages each render their own `<Navbar />` plus page chrome. To embed them cleanly:

1. Extract the inner content of each page into a sibling component:
   - `src/pages/Evaluate.tsx` → `src/components/research/EvaluateView.tsx`
   - `src/pages/Batch.tsx` → `src/components/research/BatchView.tsx`
   - `src/pages/History.tsx` → `src/components/research/HistoryView.tsx`
2. Each `*View` component contains the page body only (no `<Navbar />`, no outer page padding).
3. The original page files become thin wrappers that render `<Navbar />` + `<XView />`, so existing routes `/`, `/batch`, `/history` keep working (deep links from other parts of the app, e.g. Showcase, don't break).
4. The Research modal renders the `*View` components directly.

## Behavior details

- Modal close returns the user to the Research landing state (no tool selected).
- Only one tool open at a time; switching from the left rail swaps the modal content.
- Active top-tab highlighting: Research highlights for `/research`; the legacy routes (`/`, `/batch`, `/history`) still highlight Research as well so navigation feels consistent if someone lands there directly.
- Settings page link/icon behavior unchanged.

## Out of scope

- No changes to Evaluate/Batch/History internals, business logic, data fetching, or styling beyond the extraction.
- No changes to Companies, Reports, Demo, Showcase, or public report routes.
- No removal of the legacy `/`, `/batch`, `/history` routes — they remain as fallbacks.

## Files touched

- `src/components/layout/Navbar.tsx` — new three-tab list, active-state logic.
- `src/App.tsx` — add `/research` route.
- `src/pages/Research.tsx` — new.
- `src/components/research/EvaluateView.tsx`, `BatchView.tsx`, `HistoryView.tsx` — new (extracted bodies).
- `src/pages/Evaluate.tsx`, `Batch.tsx`, `History.tsx` — slim down to wrapper using the new View components.
