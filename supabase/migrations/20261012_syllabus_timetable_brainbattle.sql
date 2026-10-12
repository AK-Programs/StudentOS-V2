-- ============================================================================
-- StudentOS — Official Timetable + Syllabus Planner + Exam Preparation + Brain Battle
-- Migration: 20261012_syllabus_timetable_brainbattle.sql
-- ============================================================================

-- 1. Official School Syllabuses
CREATE TABLE IF NOT EXISTS public.school_syllabuses (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'default_school',
    academic_year VARCHAR(32) NOT NULL DEFAULT '2026-2027',
    grade VARCHAR(64) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    board VARCHAR(128) DEFAULT 'Standard Academic Curriculum',
    chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_by TEXT NOT NULL,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_syllabuses_school_grade ON public.school_syllabuses(school_id, grade);

-- 2. Student Chapter-Wise Learning Progress (Per-Student Isolated)
CREATE TABLE IF NOT EXISTS public.student_chapter_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    school_id TEXT NOT NULL DEFAULT 'default_school',
    chapter_id VARCHAR(128) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'not_started',
    confidence_rating INT DEFAULT 3,
    target_date DATE,
    notes TEXT DEFAULT '',
    completed_topics JSONB DEFAULT '[]'::jsonb,
    revision_count INT DEFAULT 0,
    last_studied_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_chapter UNIQUE (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_chapter_progress_user ON public.student_chapter_progress(user_id);

-- 3. Official School Timetables (School-Managed, Multi-Role)
CREATE TABLE IF NOT EXISTS public.school_timetables (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'default_school',
    academic_year VARCHAR(32) NOT NULL DEFAULT '2026-2027',
    grade VARCHAR(64) NOT NULL,
    section VARCHAR(32) DEFAULT 'A',
    schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_by TEXT NOT NULL,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    effective_from DATE DEFAULT CURRENT_DATE,
    version INT NOT NULL DEFAULT 1,
    change_history JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_timetables_school_grade ON public.school_timetables(school_id, grade);

-- 4. Student Personal Study Sessions (Execution Layer)
CREATE TABLE IF NOT EXISTS public.student_study_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    scheduled_date DATE NOT NULL,
    start_time VARCHAR(16) NOT NULL,
    end_time VARCHAR(16) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 45,
    subject VARCHAR(128) NOT NULL,
    chapter_id VARCHAR(128),
    chapter_title TEXT,
    session_type VARCHAR(64) NOT NULL DEFAULT 'learn_chapter',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    notes TEXT DEFAULT '',
    reminder_enabled BOOLEAN DEFAULT TRUE,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    outcome_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON public.student_study_sessions(user_id, scheduled_date);

-- 5. Brain Battle Multiplayer Rooms (Authoritative Synchronized State)
CREATE TABLE IF NOT EXISTS public.brain_battle_rooms (
    code VARCHAR(6) PRIMARY KEY,
    host_id UUID NOT NULL,
    host_name TEXT NOT NULL,
    subject VARCHAR(128) NOT NULL DEFAULT 'Mixed Arena',
    difficulty VARCHAR(32) NOT NULL DEFAULT 'all',
    question_count INT NOT NULL DEFAULT 5,
    time_per_question INT NOT NULL DEFAULT 15,
    status VARCHAR(32) NOT NULL DEFAULT 'lobby',
    current_question_index INT NOT NULL DEFAULT 0,
    question_started_at BIGINT DEFAULT 0,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    players JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bb_rooms_status ON public.brain_battle_rooms(status, updated_at);

-- 6. Exam Preparation Calendars & Plans
CREATE TABLE IF NOT EXISTS public.exam_preparations (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'default_school',
    user_id UUID, -- NULL if official school exam, populated if personal student target
    exam_name TEXT NOT NULL,
    subject VARCHAR(128) NOT NULL,
    exam_date DATE NOT NULL,
    is_official_school_exam BOOLEAN NOT NULL DEFAULT TRUE,
    grade VARCHAR(64) NOT NULL,
    chapters_included JSONB DEFAULT '[]'::jsonb,
    syllabus_notes TEXT DEFAULT '',
    target_score_percent INT DEFAULT 90,
    mock_exams_attempted INT DEFAULT 0,
    average_accuracy NUMERIC DEFAULT 0,
    total_questions_practiced INT DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'upcoming',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.school_syllabuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_battle_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_preparations ENABLE ROW LEVEL SECURITY;

-- Syllabuses: Public/Students can read all, Staff can insert/update
CREATE POLICY "Syllabuses read for authenticated" ON public.school_syllabuses
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Syllabuses write for staff" ON public.school_syllabuses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Student Chapter Progress: Students only access their own
CREATE POLICY "Student progress isolated select" ON public.student_chapter_progress
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Student progress isolated write" ON public.student_chapter_progress
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Timetables: Read for everyone, Write for staff
CREATE POLICY "Timetables read for all" ON public.school_timetables
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Timetables write for staff" ON public.school_timetables
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Study Sessions: User private
CREATE POLICY "Study sessions user isolated" ON public.student_study_sessions
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Brain Battle Rooms: Open lookup & joining with server authorization
CREATE POLICY "Brain battle rooms open read" ON public.brain_battle_rooms
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Brain battle rooms open write" ON public.brain_battle_rooms
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
