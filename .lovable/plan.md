

## Problem

When you save a new Airtable connection via the dialog, the `AirtableSyncButton` doesn't update because it runs its own independent `useAirtableConnection` hook. The dialog's hook refreshes internally, but the sync button's hook has no idea a connection was just created. So you're stuck seeing "Connect Airtable" with no way to sync.

## Fix

Two changes:

### 1. Force the sync button to re-fetch after the dialog closes

Add a `connectionVersion` counter in `Reports.tsx`. Increment it whenever the connection dialog closes. Pass it as a `key` prop on `AirtableSyncButton` so React remounts the component (triggering a fresh `useAirtableConnection` fetch).

### 2. Auto-sync after a new connection is saved

Update `AirtableConnectionDialog` to accept an optional `onConnectionSaved` callback. When a new connection is successfully created, fire this callback. In `Reports.tsx`, wire it up to automatically trigger a sync after saving — so the user doesn't have to manually click "Sync from Airtable" after setting up the connection.

### Files to change

- **`src/components/airtable/AirtableConnectionDialog.tsx`** — Add `onConnectionSaved?: () => void` prop, call it after successful save
- **`src/pages/Reports.tsx`** — Add `connectionVersion` state counter, increment on dialog close/save, pass as `key` to `AirtableSyncButton`; wire up auto-sync on new connection
- **`src/components/reports/UpdateCSVDialog.tsx`** — Same pattern for the update flow if applicable (uses its own AirtableConnectionDialog + SyncButton pairing)

