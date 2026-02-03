
# Fix: Update Airtable Field Mapping

## Problem
The Airtable sync is failing because the field mapping has the wrong column name:
- **Current mapping**: `scheduled_date_time` → `"Recording Date"` 
- **Actual Airtable field**: `"Scheduled Date / Time"`

## Solution

### Database Update
Update the SmartLab Learning connection to use the correct field name:

```sql
UPDATE airtable_connections 
SET field_mapping = jsonb_set(
  field_mapping::jsonb, 
  '{scheduled_date_time}', 
  '"Scheduled Date / Time"'::jsonb
)
WHERE id = 'e9e63a1d-bce6-43f5-963e-12b5fc6da316';
```

### After the Fix
Once the field mapping is corrected:
1. The Airtable sync should succeed
2. The `airtableSyncedData` state will be populated
3. Report generation without a Batch CSV will work (using the placeholder mode we implemented)

## Technical Note
The Airtable API filter formula will correctly handle the field name with spaces and special characters because we wrap field names in curly braces: `{Scheduled Date / Time}`.

---

**No code changes needed** - this is a data fix only. Once approved, I'll run the database update and you can retry the sync.
