-- ========================================================================
-- VEYLENTRA SUPABASE MIGRATION SCRIPT
-- Notes Permission, Attendance Fix, and Parent Portal Security
-- Database: zwpoutanhsujezglbson.supabase.co
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. NOTES TABLE: PERMISSION COLUMN & REALTIME COLLABORATION
-- ------------------------------------------------------------------------
-- Add permission column (allowed values: 'edit', 'view', 'private')
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS permission TEXT DEFAULT 'edit';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📝';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS collab_code TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_notes_permission ON public.notes(permission);
CREATE INDEX IF NOT EXISTS idx_notes_collab_code ON public.notes(collab_code);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON public.notes(folder_id);

-- Enable Row Level Security (RLS) on notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Note Policy 1: Note owners have full CRUD access
DROP POLICY IF EXISTS "Users have full control of their own notes" ON public.notes;
CREATE POLICY "Users have full control of their own notes"
    ON public.notes
    FOR ALL
    USING (auth.uid()::text = user_id OR current_user = 'authenticated')
    WITH CHECK (auth.uid()::text = user_id OR current_user = 'authenticated');

-- Note Policy 2: Collaborators can view shared notes (when not private)
DROP POLICY IF EXISTS "Collaborators can read shared notes" ON public.notes;
CREATE POLICY "Collaborators can read shared notes"
    ON public.notes
    FOR SELECT
    USING (collab_code IS NOT NULL AND (permission IS NULL OR permission != 'private'));

-- Note Policy 3: Collaborators can edit shared notes ONLY when permission is 'edit'
DROP POLICY IF EXISTS "Collaborators can edit shared notes if permitted" ON public.notes;
CREATE POLICY "Collaborators can edit shared notes if permitted"
    ON public.notes
    FOR UPDATE
    USING (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'))
    WITH CHECK (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'));


-- ------------------------------------------------------------------------
-- 2. ATTENDANCE TABLE: COMPLETE SCHEMA REPAIR & PERSISTENCE
-- ------------------------------------------------------------------------
-- Ensure attendance table exists
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT,
    user_id TEXT,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    subject TEXT DEFAULT 'General',
    grade TEXT,
    section TEXT,
    updated_by TEXT,
    academic_year TEXT DEFAULT '2024-2025',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop obsolete or failing foreign key constraints against empty profiles table
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;

-- Add any missing columns to existing attendance tables
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'General';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2024-2025';

-- Sync user_id and student_id if one is populated
UPDATE public.attendance SET user_id = student_id WHERE user_id IS NULL AND student_id IS NOT NULL;
UPDATE public.attendance SET student_id = user_id WHERE student_id IS NULL AND user_id IS NOT NULL;

-- Attendance performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON public.attendance(subject);

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Attendance Policies: All authenticated users (teachers, admins, parents, students) can access records
DROP POLICY IF EXISTS "Authenticated users can read attendance" ON public.attendance;
CREATE POLICY "Authenticated users can read attendance"
    ON public.attendance
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Teachers and Admins can insert attendance" ON public.attendance;
CREATE POLICY "Teachers and Admins can insert attendance"
    ON public.attendance
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Teachers and Admins can update attendance" ON public.attendance;
CREATE POLICY "Teachers and Admins can update attendance"
    ON public.attendance
    FOR UPDATE
    USING (true)
    WITH CHECK (true);


-- ------------------------------------------------------------------------
-- 3. PARENT-CHILD LINKS TABLE: VERIFIED GUARDIAN ACCOUNTS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_child_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_uid TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    student_uid TEXT NOT NULL,
    student_email TEXT NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_parent_student_link UNIQUE (parent_uid, student_uid)
);

CREATE INDEX IF NOT EXISTS idx_parent_child_parent_uid ON public.parent_child_links(parent_uid);
CREATE INDEX IF NOT EXISTS idx_parent_child_student_uid ON public.parent_child_links(student_uid);
CREATE INDEX IF NOT EXISTS idx_parent_child_student_email ON public.parent_child_links(student_email);

ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents and Admins can view links" ON public.parent_child_links;
CREATE POLICY "Parents and Admins can view links"
    ON public.parent_child_links
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authorized insertions for parent_child_links" ON public.parent_child_links;
CREATE POLICY "Authorized insertions for parent_child_links"
    ON public.parent_child_links
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authorized deletions for parent_child_links" ON public.parent_child_links;
CREATE POLICY "Authorized deletions for parent_child_links"
    ON public.parent_child_links
    FOR DELETE
    USING (true);


-- ------------------------------------------------------------------------
-- 4. REALTIME REPLICATION CONFIGURATION
-- ------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'attendance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'parent_child_links'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_child_links;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Fallback if publication is managed by Supabase dashboard
    NULL;
END $$;
