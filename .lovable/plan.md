## Plan

Add a hard intake gate to the Fireflies sync before any `call_notes` row is stored.

### What will change

1. **Limit Fireflies results to the connected CM**
   - Update the Fireflies transcript query to request transcripts for the stored `fireflies_user_id` instead of relying on whatever the API key can see.
   - Keep this as the first filter, but do not trust it as the only filter.

2. **Verify the connected CM is actually on the call**
   - Before insert, require the connected CM’s Fireflies email / platform email to appear in one of:
     - `participants`
     - `host_email`
     - `organizer_email`
   - If Troy is not on the transcript, skip it.

3. **Verify the CM is a real platform user**
   - Use the platform user tied to the Fireflies connection as the source of truth.
   - If the Fireflies email does not line up with the connected platform user identity, skip sync for that connection and report an error.

4. **Only store calls tied to that CM’s assigned clients**
   - Load active companies where `campaign_manager` includes the connected CM’s name, including exact full-name matches and safe aliases like `Troy` vs `Troy Higgins`.
   - A transcript must match one of those assigned companies before storage.
   - Matching will use conservative signals:
     - company name in the meeting title, or
     - client website domain matching an external participant email domain, or
     - assigned speaker name in the meeting title/participant text.

5. **Attach routing on insert**
   - When a call passes the gate, insert it with the matched `company_id` and best `speaker_id` when confidently detected.
   - If no assigned client match is found, the call is skipped rather than stored as unmatched noise.

6. **Improve sync diagnostics**
   - Return skipped counts by reason, e.g. `not_cm_participant`, `no_assigned_client_match`, `duplicate`, `impromptu`.
   - Surface this in the sync response so we can immediately tell why Troy’s rerun did or did not import meetings.

### Technical details

- Main file: `supabase/functions/sync-fireflies-meetings/index.ts`
- No schema change is required for the strict gate itself.
- I will avoid changing the existing synced-calls UI unless needed, because this is primarily an ingestion/routing fix.

### Expected result

After rerunning Troy’s sync, meetings like `John<>Creative Team - Check In`, all-hands, finance check-ins, and other Moburst-wide or non-client meetings should be skipped before storage. Only Troy’s calls that can be tied to Troy-assigned companies/speakers should enter `call_notes`.