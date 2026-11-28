-- ============================================================================
-- Veylentra Material Hub Intelligence Schema Migration (Idempotent, TEXT-ID)
-- Order: 02 | Grounded Q&A chunks & resource recommendations
-- ============================================================================

BEGIN;

ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS extracted_text TEXT DEFAULT '';
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'student';

CREATE TABLE IF NOT EXISTS public.material_chunks (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  section_or_page TEXT NOT NULL DEFAULT 'Section 1',
  chunk_text TEXT NOT NULL,
  subject TEXT DEFAULT 'General',
  visibility TEXT DEFAULT 'student',
  uploader_uid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_chunks_material_id ON public.material_chunks(material_id);
CREATE INDEX IF NOT EXISTS idx_material_chunks_subject ON public.material_chunks(subject);

CREATE TABLE IF NOT EXISTS public.material_recommendation_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  internal_material_ids JSONB DEFAULT '[]'::jsonb,
  external_queries JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_rec_logs_user ON public.material_recommendation_logs(user_id);

ALTER TABLE public.material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_recommendation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized visibility read on material_chunks" ON public.material_chunks;
CREATE POLICY "Authorized visibility read on material_chunks"
  ON public.material_chunks
  FOR SELECT
  USING (
    (coalesce(visibility, 'student') NOT IN ('teacher', 'faculty', 'staff', 'private'))
    OR (coalesce(visibility, 'student') IN ('teacher', 'faculty', 'staff') AND public.veylentra_is_faculty(auth.uid()::text))
    OR (visibility = 'private' AND (uploader_uid = auth.uid()::text OR public.veylentra_is_admin(auth.uid()::text)))
  );

DROP POLICY IF EXISTS "Faculty manage material_chunks" ON public.material_chunks;
CREATE POLICY "Faculty manage material_chunks"
  ON public.material_chunks
  FOR ALL
  USING (public.veylentra_is_faculty(auth.uid()::text) OR uploader_uid = auth.uid()::text)
  WITH CHECK (public.veylentra_is_faculty(auth.uid()::text) OR uploader_uid = auth.uid()::text);

DROP POLICY IF EXISTS "Users manage own material recommendation logs" ON public.material_recommendation_logs;
CREATE POLICY "Users manage own material recommendation logs"
  ON public.material_recommendation_logs
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

COMMIT;
