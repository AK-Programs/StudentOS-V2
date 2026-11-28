-- ============================================================================
-- Veylentra Upgrade Verification Queries (Read-Only)
-- Order: 98 | Run after applying migrations 01-03 to verify schema & RLS
-- ============================================================================

SELECT table_name, row_security_active
FROM (
  SELECT
    c.relname AS table_name,
    c.relrowsecurity AS row_security_active
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'ai_buddy_chats',
      'materials',
      'notes',
      'material_chunks',
      'material_recommendation_logs',
      'assignment_drafts',
      'assignment_submissions',
      'notebook_completion_reports',
      'group_projects',
      'group_project_members'
    )
) t
ORDER BY table_name;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ai_buddy_chats',
    'materials',
    'notes',
    'material_chunks',
    'material_recommendation_logs',
    'assignment_drafts',
    'assignment_submissions',
    'notebook_completion_reports',
    'group_projects',
    'group_project_members'
  )
ORDER BY tablename, policyname;
