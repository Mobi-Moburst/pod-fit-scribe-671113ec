

# Re-link Call Note and Improve Email Matching

## 1. Immediately link this call note
Update the existing call note `b777b9e3-...` to set:
- `speaker_id` = Greg Brogger's ID (`75ed4fdf-f681-4373-bb4f-57ea20b41cdf`)
- `company_id` = Collective Liquidity's ID (`2794f9f2-5da5-4db6-9798-85ba85dba626`)

## 2. Add email-based matching to the webhook
Enhance the `fathom-webhook` edge function so that when name-based matching fails, it also tries:
- Extract the local part of any email in participants (e.g., "greg" from "greg@collectiveliquidity.com")
- Match it against speaker first names (same unique-match rule as the existing first-name fallback)
- Match the email domain against company URLs (e.g., "collectiveliquidity.com" against company_url fields)

## 3. Apply same improvement to sync-fathom-meetings
Mirror the email matching logic in the `sync-fathom-meetings` edge function for consistency.

---

### Technical details

**Files modified:**
- `supabase/functions/fathom-webhook/index.ts` -- add email-based matching tier after existing name-based tiers
- `supabase/functions/sync-fathom-meetings/index.ts` -- same email matching logic

**Matching priority (updated):**
1. Exact/partial name match from participants
2. Full name scan in title/summary
3. Name-parts scan in title/summary
4. Unique first-name match in title/summary
5. **(New)** Email local-part match against speaker first names
6. **(New)** Email domain match against company URLs

