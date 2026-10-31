-- Migration: Add reordering and folder improvements
-- Description: Adds sort_order columns and a dedicated personal_tasks table.

-- 1. Add sort_order to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Add sort_order to materials table
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Add sort_order to assignments table (if used for tasks/resources)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 4. Add sort_order to school_resources table
ALTER TABLE school_resources ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 5. Create personal_tasks table for dedicated task management
CREATE TABLE IF NOT EXISTS personal_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    category TEXT,
    subject TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable RLS for personal_tasks
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for personal_tasks
CREATE POLICY "Users can manage their own personal tasks"
    ON personal_tasks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_user_sort ON notes(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_sort ON personal_tasks(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_materials_folder_sort ON materials(folder_id, sort_order);
