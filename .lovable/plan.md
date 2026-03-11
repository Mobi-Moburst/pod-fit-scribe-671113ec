

## Problem

The `AirtableSyncButton` with `variant="inline"` is missing the `AirtableConnectionDialog` component. When a speaker has no existing Airtable connection, clicking "Connect Airtable" sets `showConnectionDialog` to `true`, but no dialog is rendered -- so nothing happens.

The `compact` and `default` variants both include `<AirtableConnectionDialog>` in their JSX, but the `inline` variant (lines 50-62) does not.

## Fix

Add the `AirtableConnectionDialog` to the `inline` variant's "no connection" branch in `src/components/airtable/AirtableSyncButton.tsx`.

**File: `src/components/airtable/AirtableSyncButton.tsx`** (lines 50-63)

Change the inline variant's no-connection return from just a button to include the dialog:

```tsx
// Before (inline, no connection):
return (
  <Button ...>Connect Airtable</Button>
);

// After:
return (
  <>
    <Button ...>Connect Airtable</Button>
    <AirtableConnectionDialog
      open={showConnectionDialog}
      onOpenChange={setShowConnectionDialog}
      companyId={companyId}
      speakerId={speakerId}
      entityName={entityName}
    />
  </>
);
```

This is a one-file, ~8-line change. No database or edge function changes needed.

