# Send Showcase visitors straight to the published demo report

Right now Showcase's "demo" links go to `/demo/report`, the editor view. We'll route them directly to the prospect-facing `/demo/report/public` view and make that route self-seed so it works without ever passing through the editor.

## Changes

### 1. `src/pages/DemoPublicReport.tsx` — self-seed when there's no session data
- When `sessionStorage["demoPublishedReport"]` is missing, instead of erroring, load a default demo client (proposed: **SignalForge**, current quarter) using the same `applyQuarterToReportData` pipeline already used in `DemoReport.tsx`, with the standard prospect visibility profile (`averageScore: false`, `targetPodcasts: false`, everything else on).
- This means visiting `/demo/report/public` cold renders a full, populated published report immediately.
- The "Back to Editor" button in the top-left becomes confusing for prospects who never went through the editor. Hide it when the page is self-seeded (only show it when arriving from the editor).

### 2. `src/pages/Showcase.tsx` — point every demo link at the public view
- Replace all four `<Link to="/demo/report">` references (lines 124, 169, 269, 364) and the footer link (line 389) with `/demo/report/public`.

### 3. Leave `/demo` and `/demo/report` alone
- Internal team still uses them to pick a client, swap quarters, and publish — not removing them.

## Open question
- Default demo client for the self-seeded public view: **SignalForge** (single-speaker, cleanest demo) or **AtlasBridge** (multi-speaker, shows the company-level aggregation)? I'll use SignalForge unless you say otherwise.
