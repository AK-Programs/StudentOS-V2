-- ============================================================================
-- Veylentra Security & RLS Hardening Migration (Idempotent, TEXT-ID compatible)
-- Order: 01 | DO NOT execute automatically on production without review
-- ============================================================================

BEGIN;

-- Ensure required columns exist before creating RLS policies
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'student';
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS uploader_uid TEXT;
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Helper function: checks verified faculty/admin role from user_profiles (never client claims)
CREATE OR REPLACE FUNCTION public.veylentra_is_faculty(check_uid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE (up.id = check_uid OR up.uid = check_uid)
      AND lower(coalesce(up.role, 'student')) IN ('teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin')
  );
$$;

-- Helper function: checks admin / super_admin role
CREATE OR REPLACE FUNCTION public.veylentra_is_admin(check_uid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE (up.id = check_uid OR up.uid = check_uid)
      AND lower(coalesce(up.role, 'student')) IN ('admin', 'super_admin')
  );
$$;

-- 1. Cross-account isolation on Byte AI chat history (ai_buddy_chats)
DO $$
BEGIN
  IF to_regclass('public.ai_buddy_chats') IS NOT NULL THEN
    ALTER TABLE public.ai_buddy_chats ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can only read own ai_buddy_chats" ON public.ai_buddy_chats;
    CREATE POLICY "Users can only read own ai_buddy_chats"
      ON public.ai_buddy_chats
      FOR SELECT
      USING (auth.uid()::text = user_id);

    DROP POLICY IF EXISTS "Users can only insert own ai_buddy_chats" ON public.ai_buddy_chats;
    CREATE POLICY "Users can only insert own ai_buddy_chats"
      ON public.ai_buddy_chats
      FOR INSERT
      WITH CHECK (auth.uid()::text = user_id);

    DROP POLICY IF EXISTS "Users can only update own ai_buddy_chats" ON public.ai_buddy_chats;
    CREATE POLICY "Users can only update own ai_buddy_chats"
      ON public.ai_buddy_chats
      FOR UPDATE
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);

    DROP POLICY IF EXISTS "Users can only delete own ai_buddy_chats" ON public.ai_buddy_chats;
    CREATE POLICY "Users can only delete own ai_buddy_chats"
      ON public.ai_buddy_chats
      FOR DELETE
      USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- 2. Visibility isolation on Material Hub (students cannot read teacher-only or foreign private materials)
DO $$
BEGIN
  IF to_regclass('public.materials') IS NOT NULL THEN
    ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Authorized visibility read on materials" ON public.materials;
    CREATE POLICY "Authorized visibility read on materials"
      ON public.materials
      FOR SELECT
      USING (
        (
          coalesce(visibility, 'student') NOT IN ('teacher', 'faculty', 'staff', 'private')
        )
        OR (
          coalesce(visibility, 'student') IN ('teacher', 'faculty', 'staff')
          AND public.veylentra_is_faculty(auth.uid()::text)
        )
        OR (
          visibility = 'private'
          AND (uploader_uid = auth.uid()::text OR public.veylentra_is_admin(auth.uid()::text))
        )
      );
  END IF;
END $$;

-- 3. Strict owner isolation on student Notes Vault
DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Owners manage personal notes" ON public.notes;
    CREATE POLICY "Owners manage personal notes"
      ON public.notes
      FOR ALL
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

COMMIT;
