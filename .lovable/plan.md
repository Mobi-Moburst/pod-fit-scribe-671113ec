

# Simplify Airtable Setup with Shared PAT

## Overview
Store a single Airtable Personal Access Token (PAT) as a Supabase secret so users only need to provide the Base ID and Table ID when setting up a connection. This is perfect for your setup where one Airtable account has access to all campaign manager bases.

## Changes Required

### 1. Add Supabase Secret
- Add `AIRTABLE_PAT` (Personal Access Token) as a Supabase edge function secret
- This token should have `data.records:read` scope for all bases it needs to access

### 2. Update Edge Function (`fetch-airtable-data`)
- Read the PAT from `Deno.env.get('AIRTABLE_PAT')` instead of from the database
- Fall back to per-connection token if the global one isn't set (backward compatibility)

**Before:**
```typescript
const records = await fetchAllRecords(
  connection.base_id,
  connection.table_id,
  connection.personal_access_token,  // From database
  filterFormula
);
```

**After:**
```typescript
// Use global secret, fallback to per-connection if needed
const accessToken = Deno.env.get('AIRTABLE_PAT') || connection.personal_access_token;
const records = await fetchAllRecords(
  connection.base_id,
  connection.table_id,
  accessToken,
  filterFormula
);
```

### 3. Simplify UI Dialog
- Hide the Personal Access Token field (since it's now optional/backend-managed)
- Show a small info note: "Using shared Airtable API access"
- Keep the field available as an "advanced" option if users want to use a different token for specific connections

### 4. Update Database Column (Optional)
- Make `personal_access_token` nullable in the database
- This allows connections to be created without a per-connection token

## Technical Details

### Database Migration
```sql
-- Make personal_access_token nullable for connections using global token
ALTER TABLE airtable_connections 
  ALTER COLUMN personal_access_token DROP NOT NULL;
```

### Edge Function Logic
```typescript
// Prefer global secret, allow per-connection override
const globalToken = Deno.env.get('AIRTABLE_PAT');
const accessToken = connection.personal_access_token || globalToken;

if (!accessToken) {
  throw new Error('No Airtable access token configured');
}
```

### UI Changes
- Remove "Personal Access Token" as a required field
- Add optional "Advanced: Custom Token" collapsible section
- Simplify the main form to just:
  - Connection Name
  - Base ID (required)
  - Table ID (required)
  - Speaker Column (optional)
  - Field Mapping (collapsible)

## User Experience After Changes

**Setup Flow (one-time per company/speaker):**
1. Click "Connect Airtable" button
2. Enter Base ID (from Airtable URL)
3. Enter Table ID (from Airtable URL)
4. Optionally configure field mapping
5. Done - no token needed

## Benefits
- Much simpler setup for users
- Single token to manage/rotate
- Users don't need to understand Airtable API tokens
- Maintains flexibility for custom tokens if ever needed

## Implementation Steps
1. Add `AIRTABLE_PAT` secret via Supabase secrets
2. Database migration to make `personal_access_token` nullable
3. Update edge function to use global token
4. Simplify the connection dialog UI

