-- ============================================================================
-- Veylentra Assignment Center & Group Projects Migration (Idempotent, TEXT-ID)
-- Order: 03 | Drafts (confirmation gate), Submissions, Reports, Group Projects
-- ============================================================================

BEGIN;

-- 1. AI Assignment Drafts (Faculty-only before confirmed publication)
CREATE TABLE IF NOT EXISTS public.assignment_drafts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  class_grade TEXT DEFAULT 'Grade 10',
  class_section TEXT DEFAULT 'All Sections',
  due_date TEXT,
  max_score NUMERIC DEFAULT 20,
  instructions TEXT DEFAULT '',
  objectives JSONB DEFAULT '[]'::jsonb,
  questions JSONB DEFAULT '[]'::jsonb,
  rubric JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_by_name TEXT DEFAULT 'Faculty',
  published_assignment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_drafts_created_by ON public.assignment_drafts(created_by);
CREATE INDEX IF NOT EXISTS idx_assignment_drafts_status ON public.assignment_drafts(status);

-- 2. Assignment Submissions Tracking
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT DEFAULT 'Student',
  student_email TEXT DEFAULT '',
  class_grade TEXT DEFAULT 'Grade 10',
  class_section TEXT DEFAULT 'Solara',
  status TEXT NOT NULL DEFAULT 'submitted',
  submission_text TEXT DEFAULT '',
  attachment_url TEXT DEFAULT '',
  attachment_name TEXT DEFAULT '',
  is_late BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  score NUMERIC,
  max_score NUMERIC DEFAULT 100,
  feedback TEXT DEFAULT '',
  evaluated_by TEXT,
  evaluated_at TIMESTAMPTZ,
  results_released BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assign_subs_assignment_id ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assign_subs_student_id ON public.assignment_submissions(student_id);

-- 3. Notebook Completion Reports
CREATE TABLE IF NOT EXISTS public.notebook_completion_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_scope TEXT DEFAULT 'All Subjects',
  total_notes INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL DEFAULT 0,
  coverage_percent NUMERIC NOT NULL DEFAULT 0,
  report_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_reports_user_id ON public.notebook_completion_reports(user_id);

-- 4. Group Projects & Teams
CREATE TABLE IF NOT EXISTS public.group_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  description TEXT DEFAULT '',
  class_grade TEXT DEFAULT 'Grade 10',
  class_section TEXT DEFAULT 'All Sections',
  due_date TEXT,
  max_score NUMERIC DEFAULT 100,
  created_by TEXT NOT NULL,
  created_by_name TEXT DEFAULT 'Faculty',
  groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_projects_grade ON public.group_projects(class_grade, class_section);

CREATE TABLE IF NOT EXISTS public.group_project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.group_projects(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  member_name TEXT NOT NULL DEFAULT 'Member',
  member_role TEXT NOT NULL DEFAULT 'Builder',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_project ON public.group_project_members(project_id, group_id);

-- Enable RLS across all Assignment Center tables
ALTER TABLE public.assignment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_completion_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_project_members ENABLE ROW LEVEL SECURITY;

-- Policies: Faculty-only drafts
DROP POLICY IF EXISTS "Faculty manage assignment_drafts" ON public.assignment_drafts;
CREATE POLICY "Faculty manage assignment_drafts"
  ON public.assignment_drafts
  FOR ALL
  USING (public.veylentra_is_faculty(auth.uid()::text))
  WITH CHECK (public.veylentra_is_faculty(auth.uid()::text));

-- Policies: Student sees own submissions; faculty can review & grade
DROP POLICY IF EXISTS "Students read and submit own assignment_submissions" ON public.assignment_submissions;
CREATE POLICY "Students read and submit own assignment_submissions"
  ON public.assignment_submissions
  FOR SELECT
  USING (auth.uid()::text = student_id OR public.veylentra_is_faculty(auth.uid()::text));

DROP POLICY IF EXISTS "Students insert own assignment_submissions" ON public.assignment_submissions;
CREATE POLICY "Students insert own assignment_submissions"
  ON public.assignment_submissions
  FOR INSERT
  WITH CHECK (auth.uid()::text = student_id);

DROP POLICY IF EXISTS "Faculty update assignment_submissions" ON public.assignment_submissions;
CREATE POLICY "Faculty update assignment_submissions"
  ON public.assignment_submissions
  FOR UPDATE
  USING (public.veylentra_is_faculty(auth.uid()::text))
  WITH CHECK (public.veylentra_is_faculty(auth.uid()::text));

-- Policies: Users manage their own notebook completion reports; faculty can read
DROP POLICY IF EXISTS "Users manage own notebook_completion_reports" ON public.notebook_completion_reports;
CREATE POLICY "Users manage own notebook_completion_reports"
  ON public.notebook_completion_reports
  FOR ALL
  USING (auth.uid()::text = user_id OR public.veylentra_is_faculty(auth.uid()::text))
  WITH CHECK (auth.uid()::text = user_id);

-- Policies: Group projects
DROP POLICY IF EXISTS "Students and faculty read group_projects" ON public.group_projects;
CREATE POLICY "Students and faculty read group_projects"
  ON public.group_projects
  FOR SELECT
  USING (
    public.veylentra_is_faculty(auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.group_project_members gm
      WHERE gm.project_id = group_projects.id AND gm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Faculty manage group_projects" ON public.group_projects;
CREATE POLICY "Faculty manage group_projects"
  ON public.group_projects
  FOR ALL
  USING (public.veylentra_is_faculty(auth.uid()::text))
  WITH CHECK (public.veylentra_is_faculty(auth.uid()::text));

DROP POLICY IF EXISTS "Members and faculty read group_project_members" ON public.group_project_members;
CREATE POLICY "Members and faculty read group_project_members"
  ON public.group_project_members
  FOR SELECT
  USING (user_id = auth.uid()::text OR public.veylentra_is_faculty(auth.uid()::text));

DROP POLICY IF EXISTS "Faculty manage group_project_members" ON public.group_project_members;
CREATE POLICY "Faculty manage group_project_members"
  ON public.group_project_members
  FOR ALL
  USING (public.veylentra_is_faculty(auth.uid()::text))
  WITH CHECK (public.veylentra_is_faculty(auth.uid()::text));

COMMIT;
