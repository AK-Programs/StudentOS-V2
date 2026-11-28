-- ============================================================================
-- Veylentra Upgrade Rollback Script (Safe & Idempotent)
-- Order: 99 | Drops newly added upgrade tables/indexes if rollback is needed
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Faculty manage group_project_members" ON public.group_project_members;
DROP POLICY IF EXISTS "Members and faculty read group_project_members" ON public.group_project_members;
DROP POLICY IF EXISTS "Faculty manage group_projects" ON public.group_projects;
DROP POLICY IF EXISTS "Students and faculty read group_projects" ON public.group_projects;
DROP POLICY IF EXISTS "Users manage own notebook_completion_reports" ON public.notebook_completion_reports;
DROP POLICY IF EXISTS "Faculty update assignment_submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Students insert own assignment_submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Students read and submit own assignment_submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Faculty manage assignment_drafts" ON public.assignment_drafts;

DROP TABLE IF EXISTS public.group_project_members;
DROP TABLE IF EXISTS public.group_projects;
DROP TABLE IF EXISTS public.notebook_completion_reports;
DROP TABLE IF EXISTS public.assignment_submissions;
DROP TABLE IF EXISTS public.assignment_drafts;

DROP POLICY IF EXISTS "Users manage own material recommendation logs" ON public.material_recommendation_logs;
DROP POLICY IF EXISTS "Faculty manage material_chunks" ON public.material_chunks;
DROP POLICY IF EXISTS "Authorized visibility read on material_chunks" ON public.material_chunks;

DROP TABLE IF EXISTS public.material_recommendation_logs;
DROP TABLE IF EXISTS public.material_chunks;

COMMIT;
