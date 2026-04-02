-- ============================================================
-- Migration 012: Políticas de Storage para buckets existentes
-- Buckets: avatars (já existe), documents (criado via API)
-- ============================================================

-- ── Bucket: avatars ──────────────────────────────────────────

CREATE POLICY "avatars: allow upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "avatars: allow update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars: allow delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'avatars');

-- ── Bucket: documents ────────────────────────────────────────

CREATE POLICY "documents: allow upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');

CREATE POLICY "documents: allow update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents: allow delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'documents');
