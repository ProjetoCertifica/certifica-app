-- Add reply_to_id for message replies
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT;

-- Create media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  CREATE POLICY "Public read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service insert media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
