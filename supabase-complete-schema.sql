-- ==============================================================================
-- 🎓 STUDENTOS UNIFIED PRODUCTION DATABASE SCHEMA & SECURITY SETUP
-- ==============================================================================
-- Includes: Core Profiles, Gamification, StudentOS Life, Attendance, Gradebook,
-- Materials, Homework, Flashcards, AI Chats, Meet, Push/FCM, RLS & Realtime Sync.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. USER PROFILES & ACADEMIC ACCOUNTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY,
    uid TEXT UNIQUE,
    email TEXT,
    name TEXT DEFAULT '',
    role TEXT DEFAULT 'student',
    requested_role TEXT,
    account_status TEXT DEFAULT 'approved',
    grade TEXT DEFAULT 'Grade 10',
    section TEXT DEFAULT 'Solara',
    house TEXT DEFAULT 'Ruby',
    department TEXT,
    subjects JSONB DEFAULT '[]'::jsonb,
    specialty_subject TEXT DEFAULT 'Science',
    designation TEXT,
    photo_url TEXT,
    banner_url TEXT,
    bio TEXT,
    points INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb,
    theme_color TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 3. ACADEMIC GAMIFICATION ENGINE (XP, Badges, Streaks, Challenges)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_gamification (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    grade TEXT DEFAULT 'Grade 10',
    section TEXT DEFAULT 'Solara',
    house TEXT DEFAULT 'Ruby',
    school_id TEXT DEFAULT 'default_school',
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    level_title TEXT DEFAULT 'Rookie Scholar',
    current_streak INTEGER DEFAULT 1,
    longest_streak INTEGER DEFAULT 1,
    last_active_date TEXT,
    earned_badges JSONB DEFAULT '{}'::jsonb,
    counts JSONB DEFAULT '{
        "totalActions": 0,
        "homeworkCompleted": 0,
        "flashcardsStudied": 0,
        "quizzesCompleted": 0,
        "highScoreQuizzes": 0,
        "notesCreated": 0,
        "aiStudyUses": 0,
        "noticesRead": 0
    }'::jsonb,
    daily_trackers JSONB DEFAULT '{
        "date": "",
        "loginClaimed": false,
        "aiUsesToday": 0,
        "xpEarnedToday": 0
    }'::jsonb,
    completed_action_keys JSONB DEFAULT '[]'::jsonb,
    recent_xp_history JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gamification_xp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    xp_amount INTEGER NOT NULL,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    badge_name TEXT NOT NULL,
    badge_icon TEXT NOT NULL,
    category TEXT DEFAULT 'academic',
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- ==============================================================================
-- 4. STUDENTOS LIFE (Houses, Competitions, Clubs, Events, Gallery, Polls, News)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.life_houses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    points INTEGER DEFAULT 1000,
    rank INTEGER DEFAULT 1,
    captain TEXT,
    vice_captain TEXT,
    motto TEXT,
    house_teacher TEXT,
    trophies INTEGER DEFAULT 0,
    banner_url TEXT
);

CREATE TABLE IF NOT EXISTS public.life_competitions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    start_date TEXT,
    end_date TEXT,
    location TEXT,
    mode TEXT DEFAULT 'Offline',
    type TEXT DEFAULT 'Individual',
    max_team_size INTEGER DEFAULT 1,
    eligibility TEXT DEFAULT 'All Grades',
    prize_pool TEXT,
    status TEXT DEFAULT 'Upcoming',
    created_by TEXT,
    registered_count INTEGER DEFAULT 0,
    banner_url TEXT,
    rules JSONB DEFAULT '[]'::jsonb,
    winners JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.life_clubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    description TEXT,
    icon TEXT DEFAULT '⭐',
    lead_teacher TEXT,
    student_head TEXT,
    member_count INTEGER DEFAULT 1,
    meeting_days TEXT DEFAULT 'Weekly',
    location TEXT DEFAULT 'Activity Hall',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.life_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    date TEXT,
    time TEXT,
    location TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.life_achievements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    category TEXT DEFAULT 'Academic',
    awarded_to_uid TEXT,
    awarded_to_name TEXT,
    awarded_by TEXT,
    reason TEXT,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.life_gallery (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Events',
    cover_url TEXT,
    photo_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.life_polls (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_votes INTEGER DEFAULT 0,
    created_by TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.life_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.life_news (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'News',
    content TEXT,
    author TEXT,
    image_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    featured BOOLEAN DEFAULT false
);

-- ==============================================================================
-- 5. ATTENDANCE & LEAVE MANAGEMENT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'present', -- 'present', 'absent', 'late', 'excused'
    grade TEXT,
    section TEXT,
    subject TEXT DEFAULT 'General / Homeroom',
    remarks TEXT,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_role TEXT,
    reason TEXT NOT NULL,
    dates TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 6. CLASSROOM & STUDY TOOLS (Materials, Homework, Notes, Flashcards)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.materials (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    category TEXT,
    type TEXT NOT NULL DEFAULT '',
    url TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size BIGINT,
    description TEXT DEFAULT '',
    uploaded_by TEXT DEFAULT '',
    uploader_uid TEXT,
    uploader_house TEXT,
    uploader_section TEXT,
    class_grade TEXT,
    class_section TEXT,
    due_date TEXT,
    is_public BOOLEAN DEFAULT true,
    downloads INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.homework (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    class_grade TEXT DEFAULT 'Grade 10',
    class_section TEXT DEFAULT 'Solara',
    due_date TEXT,
    given_by TEXT,
    completed_list JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assignments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    grade TEXT DEFAULT 'Grade 10',
    section TEXT DEFAULT 'Solara',
    due_date TEXT,
    teacher_id TEXT,
    teacher_name TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT DEFAULT '',
    subject TEXT DEFAULT 'General',
    icon TEXT DEFAULT '📝',
    cover_bg TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flashcard_decks (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    subject TEXT DEFAULT 'General',
    color TEXT DEFAULT 'from-indigo-600 to-violet-800',
    icon TEXT DEFAULT '📚',
    tags JSONB DEFAULT '[]'::jsonb,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flashcards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
    user_id TEXT,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    hint TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    interval INT DEFAULT 0,
    repetition INT DEFAULT 0,
    ease_factor NUMERIC(4, 2) DEFAULT 2.50,
    next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reviewed_date TIMESTAMP WITH TIME ZONE,
    state TEXT DEFAULT 'new',
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 7. GRADEBOOK, REPORT CARDS & CALENDAR
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.gradebook_assessments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    class_grade TEXT NOT NULL DEFAULT 'Grade 10',
    class_section TEXT NOT NULL DEFAULT 'Solara',
    subject TEXT NOT NULL DEFAULT 'Mathematics',
    period TEXT NOT NULL DEFAULT 'Term 1',
    type TEXT NOT NULL DEFAULT 'Quiz',
    max_score NUMERIC NOT NULL DEFAULT 100,
    date TEXT NOT NULL,
    teacher_id TEXT,
    teacher_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gradebook_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assessment_id TEXT NOT NULL REFERENCES public.gradebook_assessments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    student_name TEXT,
    score NUMERIC DEFAULT 0,
    max_score NUMERIC DEFAULT 100,
    percentage NUMERIC DEFAULT 0,
    letter_grade TEXT DEFAULT 'A',
    comment TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assessment_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.report_cards (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    section TEXT NOT NULL,
    academic_year TEXT DEFAULT '2026-2027',
    term TEXT NOT NULL,
    subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
    overall_percentage NUMERIC DEFAULT 0,
    overall_grade TEXT DEFAULT 'A',
    status TEXT NOT NULL DEFAULT 'draft',
    attendance_summary JSONB DEFAULT '{}'::jsonb,
    teacher_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, term)
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    category TEXT NOT NULL DEFAULT 'Academic',
    target_audience TEXT DEFAULT 'All',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 8. AI ASSISTANTS, COMMUNICATIONS & MEET
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_buddy_chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'Study Session',
    persona_id TEXT DEFAULT 'study_buddy',
    mode TEXT DEFAULT 'explanatory',
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'group',
    code TEXT,
    creator_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_room_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    sender_role TEXT,
    sender_house TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'announcement',
    user_id TEXT,
    link_tab TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT UNIQUE NOT NULL,
    user_id TEXT,
    device_id TEXT,
    keys JSONB,
    p256dh TEXT,
    auth TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meetings (
    id VARCHAR(64) PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT DEFAULT 'General',
    class_name TEXT,
    host_id UUID NOT NULL,
    host_name TEXT NOT NULL,
    host_email TEXT NOT NULL,
    join_link TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'upcoming',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role VARCHAR(32) DEFAULT 'participant',
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.global_data (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    content TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_updates (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'published',
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8B. STUDENTOS WHITEBOARD CLOUD FILES & ASSET REQUESTS (RLS + SCHOOL ISOLATED)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.whiteboard_documents (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'default_school',
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    document_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whiteboard_files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT DEFAULT 'General',
    owner_id TEXT NOT NULL,
    owner_name TEXT DEFAULT 'StudentOS User',
    owner_role TEXT DEFAULT 'student',
    school_id TEXT NOT NULL DEFAULT 'default_school',
    slide_count INTEGER NOT NULL DEFAULT 1,
    format TEXT NOT NULL DEFAULT 'studentos-whiteboard',
    schema_version INTEGER NOT NULL DEFAULT 1,
    document_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_board_asset_requests (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'default_school',
    requester_id TEXT NOT NULL,
    requester_name TEXT DEFAULT 'StudentOS User',
    requester_role TEXT DEFAULT 'student',
    asset_type TEXT NOT NULL DEFAULT '3d_model', -- '3d_model' | 'svg_diagram'
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    prompt TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'fulfilled' | 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whiteboard_asset_requests (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    requester_name TEXT DEFAULT 'StudentOS User',
    requester_role TEXT DEFAULT 'student',
    school_id TEXT NOT NULL DEFAULT 'default_school',
    request_type TEXT NOT NULL DEFAULT '3d_model', -- '3d_model' | 'svg_diagram'
    topic TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT 'General',
    class_grade TEXT DEFAULT '',
    purpose TEXT DEFAULT '',
    urgency TEXT NOT NULL DEFAULT 'normal', -- 'normal' | 'urgent'
    status TEXT NOT NULL DEFAULT 'Requested', -- 'Requested' | 'Under Review' | 'In Progress' | 'Ready' | 'Rejected'
    admin_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.whiteboard_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_board_asset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_asset_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.whiteboard_documents TO anon, authenticated;
GRANT ALL ON public.whiteboard_files TO anon, authenticated;
GRANT ALL ON public.ai_board_asset_requests TO anon, authenticated;
GRANT ALL ON public.whiteboard_asset_requests TO anon, authenticated;

-- School-isolated & owner-isolated RLS policies for Whiteboard Files
DROP POLICY IF EXISTS "whiteboard_files_select_policy" ON public.whiteboard_files;
CREATE POLICY "whiteboard_files_select_policy" ON public.whiteboard_files
    FOR SELECT USING (
        owner_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true), owner_id)
        AND school_id = COALESCE(
            (SELECT COALESCE(raw_data->>'school_id', 'default_school') FROM public.user_profiles WHERE id = auth.uid()::text LIMIT 1),
            school_id
        )
    );

DROP POLICY IF EXISTS "whiteboard_files_insert_policy" ON public.whiteboard_files;
CREATE POLICY "whiteboard_files_insert_policy" ON public.whiteboard_files
    FOR INSERT WITH CHECK (
        owner_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true), owner_id)
    );

DROP POLICY IF EXISTS "whiteboard_files_update_policy" ON public.whiteboard_files;
CREATE POLICY "whiteboard_files_update_policy" ON public.whiteboard_files
    FOR UPDATE USING (
        owner_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true), owner_id)
    );

DROP POLICY IF EXISTS "whiteboard_files_delete_policy" ON public.whiteboard_files;
CREATE POLICY "whiteboard_files_delete_policy" ON public.whiteboard_files
    FOR DELETE USING (
        owner_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true), owner_id)
    );

-- School-isolated RLS policies for Whiteboard Asset Requests
DROP POLICY IF EXISTS "whiteboard_asset_requests_select_policy" ON public.whiteboard_asset_requests;
CREATE POLICY "whiteboard_asset_requests_select_policy" ON public.whiteboard_asset_requests
    FOR SELECT USING (
        requester_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true), requester_id)
        OR EXISTS (
            SELECT 1 FROM public.user_profiles u
            WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "whiteboard_asset_requests_insert_policy" ON public.whiteboard_asset_requests;
CREATE POLICY "whiteboard_asset_requests_insert_policy" ON public.whiteboard_asset_requests
    FOR INSERT WITH CHECK (
        requester_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true), requester_id)
    );

DROP POLICY IF EXISTS "whiteboard_asset_requests_update_policy" ON public.whiteboard_asset_requests;
CREATE POLICY "whiteboard_asset_requests_update_policy" ON public.whiteboard_asset_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles u
            WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'super_admin')
        )
    );

-- ==============================================================================
-- 9. SEED INITIAL HOUSES & SYSTEM DATA (Safe Idempotent Inserts)
-- ==============================================================================
INSERT INTO public.life_houses (id, name, color, points, rank, captain, vice_captain, motto, house_teacher, trophies, banner_url)
VALUES
('Ruby', 'Red Ruby Lions', 'from-red-600 to-rose-900', 1450, 1, 'Aarav Sharma', 'Ananya Gupta', 'Courage, Honor & Victory', 'Mr. Rajesh Verma', 12, 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80'),
('Emerald', 'Green Emerald Falcons', 'from-emerald-600 to-teal-900', 1380, 2, 'Rohan Mehta', 'Siddharth Rao', 'Wisdom, Growth & Excellence', 'Dr. Sunita Patel', 9, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80'),
('Sapphire', 'Blue Sapphire Dragons', 'from-blue-600 to-indigo-900', 1310, 3, 'Priya Nair', 'Kavya Singh', 'Strength, Loyalty & Truth', 'Mrs. Deepa Roy', 8, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'),
('Topaz', 'Yellow Topaz Phoenix', 'from-amber-500 to-yellow-800', 1240, 4, 'Vikram Joshi', 'Diya Kapoor', 'Radiance, Passion & Unity', 'Mr. Amit Saxena', 7, 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO NOTHING;

-- Ensure StudentOS Storage Bucket is configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('StudentOS', 'StudentOS', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES — OPEN & SECURE DEMO CONFIGURATION
-- ==============================================================================
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_ops_%I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "allow_all_ops_%I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;

-- Storage RLS
DROP POLICY IF EXISTS "allow_all_studentos_storage" ON storage.objects;
CREATE POLICY "allow_all_studentos_storage" ON storage.objects FOR ALL USING (bucket_id = 'StudentOS') WITH CHECK (bucket_id = 'StudentOS');

-- ==============================================================================
-- 11. SUPABASE REALTIME REPLICATION (Instant Sync Across Browser Windows)
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.student_gamification,
    public.life_competitions,
    public.life_events,
    public.life_clubs,
    public.life_achievements,
    public.life_gallery,
    public.life_houses,
    public.life_polls,
    public.life_news,
    public.attendance,
    public.materials,
    public.homework,
    public.notes,
    public.chat_room_messages,
    public.notifications,
    public.system_updates;
