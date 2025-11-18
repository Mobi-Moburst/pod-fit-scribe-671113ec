-- Create reports table for storing generated reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  quarter TEXT,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  report_data JSONB NOT NULL,
  batch_session_id UUID REFERENCES batch_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org-level access
CREATE POLICY "Enable read access for org"
  ON reports FOR SELECT
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
  ON reports FOR INSERT
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
  ON reports FOR UPDATE
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
  ON reports FOR DELETE
  USING (org_id = get_team_org_id());

-- Indexes for faster queries
CREATE INDEX idx_reports_client_quarter ON reports(client_id, quarter);
CREATE INDEX idx_reports_org_date ON reports(org_id, date_range_start, date_range_end);