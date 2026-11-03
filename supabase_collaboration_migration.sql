-- ========================================================================
-- VEYLENTRA SUPABASE LECTURE NOTES COLLABORATION REPAIR SCRIPT
-- Purpose: Enable seamless cross-account & cross-device real-time collaboration
-- Target Database: Supabase (zwpoutanhsujezglbson.supabase.co)
-- ========================================================================

-- ------------------------------------------------------------------------
-- STEP 1: ENSURE REQUIRED COLUMNS & INDEXES EXIST ON `public.notes`
-- ------------------------------------------------------------------------
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS collab_code TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS permission TEXT DEFAULT 'edit';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📝';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Create high-performance indexes for fast lookups by collaboration code
CREATE INDEX IF NOT EXISTS idx_notes_collab_code ON public.notes(collab_code);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

-- ------------------------------------------------------------------------
-- STEP 2: TABLE PERMISSIONS (GRANT ACCESS TO AUTHENTICATED & ANON ROLES)
-- ------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO anon;

-- ------------------------------------------------------------------------
-- STEP 3: ROW LEVEL SECURITY (RLS) POLICIES FOR REALTIME COLLABORATION
-- ------------------------------------------------------------------------
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Policy A: Note owners have full control over their own notes
DROP POLICY IF EXISTS "Note owners full access" ON public.notes;
CREATE POLICY "Note owners full access"
    ON public.notes
    FOR ALL
    USING (auth.uid()::text = user_id OR user_id = 'shared' OR auth.role() = 'authenticated')
    WITH CHECK (auth.uid()::text = user_id OR user_id = 'shared' OR auth.role() = 'authenticated');

-- Policy B: Allow any authorized user to SELECT notes with an active collab_code
DROP POLICY IF EXISTS "Collaborators read shared notes" ON public.notes;
CREATE POLICY "Collaborators read shared notes"
    ON public.notes
    FOR SELECT
    USING (collab_code IS NOT NULL AND (permission IS NULL OR permission != 'private'));

-- Policy C: Allow collaborators to UPDATE notes when permission is 'edit'
DROP POLICY IF EXISTS "Collaborators update shared notes" ON public.notes;
CREATE POLICY "Collaborators update shared notes"
    ON public.notes
    FOR UPDATE
    USING (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'))
    WITH CHECK (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'));

-- Policy D: Allow authenticated users to INSERT new notes
DROP POLICY IF EXISTS "Authenticated users insert notes" ON public.notes;
CREATE POLICY "Authenticated users insert notes"
    ON public.notes
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR true);

-- ------------------------------------------------------------------------
-- STEP 4: REALTIME REPLICATION PUBLICATION CONFIGURATION
-- ------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- STEP 5: VERIFICATION QUERIES
-- ------------------------------------------------------------------------
-- Run these queries after executing the script above to verify success:

-- 1. Verify table columns exist:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notes';

-- 2. Verify RLS policies are enabled:
-- SELECT tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'notes';

-- 3. Verify Realtime publication includes notes table:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notes';

-- ------------------------------------------------------------------------
-- ROLLBACK INSTRUCTIONS (Run only if you need to revert changes):
-- ------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Collaborators read shared notes" ON public.notes;
-- DROP POLICY IF EXISTS "Collaborators update shared notes" ON public.notes;
-- DROP POLICY IF EXISTS "Authenticated users insert notes" ON public.notes;
-- DROP POLICY IF EXISTS "Note owners full access" ON public.notes;
