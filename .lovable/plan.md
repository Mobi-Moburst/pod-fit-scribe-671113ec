

## Auto-populate report name with company name

The "Report Name" field starts empty after generating a report. The screenshot shows just "Q4 2025 Campaign Report" without a company name.

### Changes

**File: `src/pages/Reports.tsx`**

After each `setReportData(report)` call (both multi-speaker ~line 619 and single-speaker ~line 719), auto-populate `reportName` if it's currently empty:

- **Multi-speaker path (~line 619):** After `setReportData(report)`, add:
  ```tsx
  if (!reportName) {
    setReportName(`${selectedCompany?.name} - ${quarter || 'Report'}`);
  }
  ```

- **Single-speaker path (~line 719):** After `setReportData(report)`, add:
  ```tsx
  if (!reportName) {
    setReportName(`${selectedCompany?.name} - ${quarter || 'Report'}`);
  }
  ```

This ensures the Save Report field pre-fills with e.g. "SignalForge - Q4 2025" while still allowing users to override it before generation.

Also update the placeholder on the input (~line 2353) from `"Q4 2025 Campaign Report"` to `"Company - Q4 2025"` to hint at the expected format.

