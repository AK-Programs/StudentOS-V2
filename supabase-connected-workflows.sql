-- ==============================================================================
-- VEYLENTRA CONNECTED ACADEMIC WORKFLOW 2.0 — ADDITIVE MIGRATION
-- Safe, idempotent SQL migration extending existing StudentOS tables and adding
-- assignment_submissions, attendance_audit_logs, announcements, announcement_reads.
-- ==============================================================================

-- 1. Extend homework (assignments) lifecycle columns
ALTER TABLE IF EXISTS public.homework
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS teacher_id TEXT,
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS submission_requirements TEXT DEFAULT 'text_or_link',
    ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100,
    ADD COLUMN IF NOT EXISTS allow_late BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_homework_grade_section_status
    ON public.homework (class_grade, class_section, status);

-- 2. Assignment submissions & evaluation lifecycle table
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL DEFAULT 'Student',
    student_email TEXT,
    class_grade TEXT,
    class_section TEXT,
    status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'late' | 'under_evaluation' | 'evaluated' | 'returned_for_revision'
    submission_text TEXT DEFAULT '',
    attachment_url TEXT DEFAULT '',
    attachment_name TEXT DEFAULT '',
    is_late BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    score NUMERIC,
    max_score NUMERIC DEFAULT 100,
    feedback TEXT DEFAULT '',
    evaluated_by TEXT,
    evaluated_at TIMESTAMPTZ,
    results_released BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
    ON public.assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student
    ON public.assignment_submissions (student_id);

-- 3. Extend gradebook_assessments for published/draft/cancelled + syllabus + result gating
ALTER TABLE IF EXISTS public.gradebook_assessments
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS syllabus_coverage TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS results_published BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Auditable attendance correction log
CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id TEXT,
    student_id TEXT NOT NULL,
    student_name TEXT,
    date TEXT NOT NULL,
    subject TEXT DEFAULT 'General / Homeroom',
    grade TEXT,
    section TEXT,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT DEFAULT '',
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_student_date
    ON public.attendance_audit_logs (student_id, date);

-- 5. Targeted announcements + per-user read tracking
CREATE TABLE IF NOT EXISTS public.announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tag TEXT DEFAULT 'Notice',
    priority TEXT DEFAULT 'normal', -- 'normal' | 'important' | 'urgent'
    target_role TEXT DEFAULT 'all', -- 'all' | 'student' | 'teacher' | 'coordinator'
    target_grade TEXT DEFAULT 'all',
    target_section TEXT DEFAULT 'all',
    target_subject TEXT DEFAULT 'all',
    attachments JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'published', -- 'draft' | 'published' | 'archived'
    author_id TEXT,
    author_name TEXT,
    author_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
    announcement_id TEXT NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_status_target
    ON public.announcements (status, target_grade, target_section, target_role);

-- 6. RLS & Grants (matching StudentOS Firebase+Supabase hybrid auth model + strict server validation)
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.assignment_submissions TO anon, authenticated;
GRANT ALL ON public.attendance_audit_logs TO anon, authenticated;
GRANT ALL ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcement_reads TO anon, authenticated;

DROP POLICY IF EXISTS "allow_all_ops_assignment_submissions" ON public.assignment_submissions;
CREATE POLICY "allow_all_ops_assignment_submissions" ON public.assignment_submissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_ops_attendance_audit_logs" ON public.attendance_audit_logs;
CREATE POLICY "allow_all_ops_attendance_audit_logs" ON public.attendance_audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_ops_announcements" ON public.announcements;
CREATE POLICY "allow_all_ops_announcements" ON public.announcements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_ops_announcement_reads" ON public.announcement_reads;
CREATE POLICY "allow_all_ops_announcement_reads" ON public.announcement_reads FOR ALL USING (true) WITH CHECK (true);

-- 7. Safely attach new tables to supabase_realtime publication if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_submissions;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.gradebook_assessments;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.gradebook_entries;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
END $$;
