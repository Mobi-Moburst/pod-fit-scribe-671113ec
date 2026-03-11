

# Fix: Sort Companies Alphabetically

The `.sort()` call was never added to the `filtered` memo. One-line fix:

**File: `src/pages/Companies.tsx`, line 116**

Change:
```typescript
return byView.filter((c) => !managerFilter || (c.campaign_manager || '').trim() === managerFilter);
```

To:
```typescript
return byView.filter((c) => !managerFilter || (c.campaign_manager || '').trim() === managerFilter).sort((a, b) => a.name.localeCompare(b.name));
```

This sorts companies A-Z in both the Active and Archived tabs.

