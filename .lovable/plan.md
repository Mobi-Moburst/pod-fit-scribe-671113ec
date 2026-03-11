

# Support Multiple Campaign Managers Per Company

## Problem
The campaign manager field is a single text string. When users enter "Kylie Adams, Talia Eaton", it's stored and displayed as one string. The filter dropdown also treats it as a single value, so filtering by individual managers doesn't work.

## Approach
Keep the DB column as `text` — no schema change needed. Store comma-separated names. Update the UI and logic to **split on commas** when displaying and filtering.

## Changes

### 1. `src/pages/Companies.tsx` — Filter logic (lines 113-116)
- **Managers list**: Split each company's `campaign_manager` by comma, trim each name, collect unique individual names for the filter dropdown.
- **Filter**: When a manager filter is selected, check if the company's comma-separated list includes that manager.

### 2. `src/components/companies/CompanyCard.tsx` — Display (lines 87-91)
- Split `campaign_manager` by comma and render a separate badge/pill for each CM name, instead of one combined badge.

### 3. `src/pages/Companies.tsx` — Edit form (line 382)
- No change needed — the text input already allows free-form entry with commas. Optionally add helper text like "Separate multiple with commas".

