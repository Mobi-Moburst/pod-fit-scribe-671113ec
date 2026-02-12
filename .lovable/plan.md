

# Fix Episode Link Column Mapping

## Problem
The Airtable column for episode links is named **"Link to episode"** in the actual Airtable base, but the field mapping stored in the database is set to **"Episode Link"**. Since Airtable field names are case-sensitive, the edge function finds no match and returns empty values.

## Fix
Update the field mapping for Dr. Berry's connection (SmartLab Learning Activity) in the `airtable_connections` table so that `link_to_episode` points to the correct column name: `"Link to episode"`.

Additionally, update the **default field mapping** in the database schema and the connection dialog so that new connections default to `"Link to episode"` instead of `"Episode Link"`, preventing this issue for future setups.

## Technical Details

### 1. Update existing connection (database)
Run an update on the `airtable_connections` table for connection `e9e63a1d-bce6-43f5-963e-12b5fc6da316` to change the `link_to_episode` value in `field_mapping` from `"Episode Link"` to `"Link to episode"`.

### 2. Update default field mapping
In the database column default for `field_mapping` and in the `AirtableConnectionDialog` component, change the default value for `link_to_episode` from `"Episode Link"` to `"Link to episode"` so new connections use the correct column name out of the box.

### 3. Verify
Re-sync Dr. Berry's data and confirm the Episode Link column now populates in the preview table.

