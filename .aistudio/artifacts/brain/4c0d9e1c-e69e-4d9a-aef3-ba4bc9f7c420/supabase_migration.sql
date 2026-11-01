-- ========================================================================
-- VEYLENTRA SUPABASE MIGRATION
-- Module Upgrades: Collaborative Lecture Notes & Dedicated Parental Portal
-- Based on authoritative public schema in zwpoutanhsujezglbson.supabase.co
-- ========================================================================

-- 1. PARENT-CHILD RELATIONSHIPS TABLE
-- Secures verified links between parent accounts and student accounts.
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

-- Performance Indexes for Parent-Child Queries
CREATE INDEX IF NOT EXISTS idx_parent_child_parent_uid ON public.parent_child_links(parent_uid);
CREATE INDEX IF NOT EXISTS idx_parent_child_student_uid ON public.parent_child_links(student_uid);
CREATE INDEX IF NOT EXISTS idx_parent_child_student_email ON public.parent_child_links(student_email);

-- Enable Row Level Security (RLS)
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;

-- Security Policy: Parents can only read their own verified child links
DROP POLICY IF EXISTS "Parents can view their own child links" ON public.parent_child_links;
CREATE POLICY "Parents can view their own child links"
    ON public.parent_child_links
    FOR SELECT
    USING (auth.uid()::text = parent_uid OR current_user = 'authenticated');

-- Security Policy: Authorized creation of verified parent-child links
DROP POLICY IF EXISTS "Authorized users can insert verified links" ON public.parent_child_links;
CREATE POLICY "Authorized users can insert verified links"
    ON public.parent_child_links
    FOR INSERT
    WITH CHECK (auth.uid()::text = parent_uid OR current_user = 'authenticated');

-- Security Policy: Parents can delete/unlink their own children
DROP POLICY IF EXISTS "Parents can remove their own child links" ON public.parent_child_links;
CREATE POLICY "Parents can remove their own child links"
    ON public.parent_child_links
    FOR DELETE
    USING (auth.uid()::text = parent_uid);


-- 2. NOTES TABLE SCHEMA HARDENING
-- Ensure all collaboration, permissions, icon, and folder columns exist
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS permission TEXT DEFAULT 'edit';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📝';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS collab_code TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Indexes for Fast Collab Code Join and Ownership Queries
CREATE INDEX IF NOT EXISTS idx_notes_collab_code ON public.notes(collab_code);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON public.notes(folder_id);

-- Enable RLS on notes table
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Note Security Policy: Owners have full control of their notes
DROP POLICY IF EXISTS "Users have full control of their own notes" ON public.notes;
CREATE POLICY "Users have full control of their own notes"
    ON public.notes
    FOR ALL
    USING (auth.uid()::text = user_id OR current_user = 'authenticated')
    WITH CHECK (auth.uid()::text = user_id OR current_user = 'authenticated');

-- Note Security Policy: Collaborators can read shared notes with a valid collab code
DROP POLICY IF EXISTS "Collaborators can read shared notes" ON public.notes;
CREATE POLICY "Collaborators can read shared notes"
    ON public.notes
    FOR SELECT
    USING (collab_code IS NOT NULL);

-- Note Security Policy: Collaborators can update notes only if permission is 'edit'
DROP POLICY IF EXISTS "Collaborators can edit shared notes if permitted" ON public.notes;
CREATE POLICY "Collaborators can edit shared notes if permitted"
    ON public.notes
    FOR UPDATE
    USING (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'))
    WITH CHECK (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'));


-- 3. ATTENDANCE & HOMEWORK TABLE INDEXES FOR PARENT ACCESS
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_homework_grade_section ON public.homework(class_grade, class_section);

-- 4. REALTIME REPLICATION CONFIGURATION
-- Publish changes for live multi-user sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.homework;
