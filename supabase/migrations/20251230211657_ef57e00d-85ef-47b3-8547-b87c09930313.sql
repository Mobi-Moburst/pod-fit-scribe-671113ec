-- Create storage bucket for report highlight clips
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-highlights', 'report-highlights', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload highlights"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-highlights');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update highlights"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'report-highlights');

-- Allow authenticated users to delete highlights
CREATE POLICY "Authenticated users can delete highlights"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'report-highlights');

-- Allow public read access for embedding in reports
CREATE POLICY "Public can view highlights"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'report-highlights');