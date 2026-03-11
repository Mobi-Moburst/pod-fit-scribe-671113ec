

# Surface Competitor Episode Details in Peer Comparison Dialog

## Summary
The `fetch-podchaser-credits` edge function already returns full episode data (title, podcast name, air date, role) per competitor, but the frontend discards it -- only `interview_count` is stored. This plan threads the episode data through to the `SOVChartDialog` and displays it when a user clicks on a competitor in the chart legend.

## Changes

### 1. Store episode data alongside competitor counts

**`src/pages/Reports.tsx`**

- Expand the `competitorInterviews` state type from `{ name; role; count }` to include an optional `episodes` array:
  ```ts
  episodes?: Array<{ title: string; podcast_name: string; air_date: string; role: string }>
  ```
- In `autoFetchPeerComparison`, when mapping results back to state, also store `result.episodes` alongside `result.interview_count`.
- When building `sov_analysis` for the report (in `generateReport` / `generateMultiSpeakerReport`), pass the episodes array into each competitor entry.

### 2. Extend the `sov_analysis` type to include episodes

**`src/types/reports.ts`**

- Add an optional `episodes` field to the competitor entries in `sov_analysis`:
  ```ts
  competitors: Array<{
    name: string;
    role?: string;
    peer_reason?: string;
    linkedin_url?: string;
    interview_count: number;
    episodes?: Array<{
      title: string;
      podcast_name: string;
      air_date: string;
      role: string;
    }>;
  }>;
  ```

### 3. Display episode details in the Peer Comparison dialog

**`src/components/reports/SOVChartDialog.tsx`**

- Expand the `CompetitorInfoCard` popover to show an episode list below the existing peer reason and interview count:
  - If `episodes` array exists and has entries, render a scrollable list (max-height ~200px) showing each episode as a compact row: podcast name (bold), episode title, and formatted air date.
  - If no episodes (manual entry or Podchaser plan limitation), show the existing count-only view with a subtle note: "Episode details unavailable -- data entered manually or Podchaser plan limited."
- The popover width increases slightly to accommodate the episode list (`min-w-[320px]`).

### 4. Thread episodes through report generation

**`src/utils/reportGenerator.ts`** (or wherever `sov_analysis` is assembled)

- When building the `sov_analysis` object from `manualSOVCompetitors`, include the `episodes` field if present. Manual-entry competitors will simply have no `episodes` array.

## Technical Details

### Data flow:
```text
Podchaser API → fetch-podchaser-credits (already returns episodes)
  → autoFetchPeerComparison in Reports.tsx (currently discards episodes → will now store them)
    → competitorInterviews state (gains episodes field)
      → report generation (episodes passed into sov_analysis.competitors)
        → SOVChartDialog → CompetitorInfoCard (renders episode list)
```

### Files modified:
- `src/types/reports.ts` -- add `episodes` to competitor type
- `src/pages/Reports.tsx` -- store episodes from Podchaser response, pass through to report
- `src/components/reports/SOVChartDialog.tsx` -- render episode list in CompetitorInfoCard
- `src/utils/reportGenerator.ts` -- thread episodes into sov_analysis assembly

### No backend changes needed
The edge function already returns the episode data. This is purely a frontend data-threading and UI addition.

### Backward compatibility
Existing saved reports without episode data will simply show the count-only view -- the `episodes` field is optional throughout.

