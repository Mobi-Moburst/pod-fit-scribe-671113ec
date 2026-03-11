

## Link Saved Reports to Speaker History

### What exists today
- **Saved reports** are stored in the `reports` table with `company_id`, `speaker_id`, quarter, etc.
- **Publishing** already generates a `public_slug` and makes the report accessible at `/report/{slug}` — this is the shareable client-facing URL.
- **Speaker History** tab shows `quarterly_notes` (JSONB array of `{ quarter, notes, created_at }`).

### What we'll add

#### 1. Auto-log a report entry to speaker history on save
When a report is saved (`handleSaveReport` in `Reports.tsx`), automatically append a quarterly note entry to the speaker's `quarterly_notes` with:
- The quarter string
- A note like: `"📊 Campaign report saved: {reportName}"` with a link to the report once published
- The report ID stored in the entry so it can be linked

We'll extend the `QuarterlyNote` type to optionally include `report_id` and `report_slug`:
```
{ quarter, notes, created_at, report_id?, report_slug? }
```

For multi-speaker reports, the entry gets added to each selected speaker's history.

#### 2. Auto-publish on save (generate public slug)
Currently saving and publishing are separate steps. We'll auto-generate the `public_slug` at save time so the report immediately has a shareable URL. The user can still unpublish later if needed.

This means the report link in the speaker history is immediately functional.

#### 3. Display report links in History tab
Update `QuarterlyNotesHistory` in `SpeakerProfileCard.tsx` to detect entries with `report_id` and render them with a clickable link to `/report/{slug}` (opens in new tab). These entries get a distinct visual treatment (report icon instead of plain note).

### Files to change

1. **`src/pages/Reports.tsx`** — In `handleSaveReport`: after inserting the report, auto-publish it (generate slug, set `is_published = true`), then append a quarterly note entry with report_id and public_slug to the speaker(s)' `quarterly_notes`.

2. **`src/components/companies/SpeakerProfileCard.tsx`** — Extend `QuarterlyNote` type to include optional `report_id` and `report_slug`. Render report-linked entries with a link icon and clickable URL.

### Technical detail
- The save flow becomes: insert report → get back the report ID → generate slug → update report with slug → append note to speaker(s) quarterly_notes
- For multi-speaker reports, iterate over `selectedSpeakerIds` and append the note to each speaker's history
- The note text will be concise: `"Campaign report saved: {reportName} — {quarter}"`
- Report-linked history entries are visually distinct with a FileText icon and "View Report" link

