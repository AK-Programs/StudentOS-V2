-- ==============================================================================
-- VEYLENTRA - PERSONAL TASKS TABLE UPGRADE SCHEMA & POLICIES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.personal_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    completed BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'general',
    subject TEXT DEFAULT 'General',
    due_date TEXT,
    start_date TEXT,
    estimated_minutes INTEGER DEFAULT 0,
    actual_minutes INTEGER DEFAULT 0,
    subtasks JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    linked_session_id TEXT,
    linked_deck_id TEXT,
    kanban_column_id TEXT DEFAULT 'todo',
    sort_order INTEGER DEFAULT 0,
    parent_task_id TEXT,
    recurring_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if table was previously created with minimal schema
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 0;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER DEFAULT 0;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS linked_session_id TEXT;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS linked_deck_id TEXT;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS kanban_column_id TEXT DEFAULT 'todo';
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS parent_task_id TEXT;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS recurring_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Index for quick lookup per user
CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_id ON public.personal_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_status ON public.personal_tasks(status);

-- Enable RLS
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policy for personal tasks
DROP POLICY IF EXISTS allow_all_ops_personal_tasks ON public.personal_tasks;
CREATE POLICY allow_all_ops_personal_tasks ON public.personal_tasks FOR ALL USING (true) WITH CHECK (true);
