

# Move Fathom Buttons to Filter Bar

## Changes to `src/pages/Companies.tsx`

1. **Remove** `<SyncFathomButton>` from the header card (line 297)
2. **Add** `<SyncFathomButton>` inside the filter bar (lines 310-328), positioned after the campaign manager dropdown, conditionally rendered only when `managerFilter !== ''`

The filter bar section will become:
```tsx
<div className="flex items-center gap-4 flex-wrap">
  <Tabs .../>
  {managers.length > 0 && (
    <div className="flex items-center gap-2">
      <Label ...>Campaign Manager</Label>
      <select ...>...</select>
    </div>
  )}
  {managerFilter && <SyncFathomButton onSyncComplete={loadData} />}
</div>
```

Single file, two small edits.

