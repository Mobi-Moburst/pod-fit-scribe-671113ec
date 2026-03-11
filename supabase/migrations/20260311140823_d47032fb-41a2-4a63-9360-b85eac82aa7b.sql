ALTER TABLE companies ADD COLUMN archived_at timestamptz DEFAULT NULL;
ALTER TABLE speakers ADD COLUMN archived_at timestamptz DEFAULT NULL;