-- Create storage bucket for speaker headshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('speaker-headshots', 'speaker-headshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view headshots (public bucket)
CREATE POLICY "Public can view headshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'speaker-headshots');

-- Allow org members to upload headshots
CREATE POLICY "Org members can upload headshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'speaker-headshots');

-- Allow org members to update headshots
CREATE POLICY "Org members can update headshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'speaker-headshots');

-- Allow org members to delete headshots
CREATE POLICY "Org members can delete headshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'speaker-headshots');