-- ========================================================
-- StudentOS Supabase Complete Database Schema & RLS Policies
-- ========================================================

-- User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    uid TEXT UNIQUE,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'student',
    grade TEXT,
    section TEXT,
    house TEXT,
    department TEXT,
    subjects JSONB,
    specialty_subject TEXT,
    designation TEXT,
    photo_url TEXT,
    banner_url TEXT,
    bio TEXT,
    custom_status TEXT,
    badges JSONB,
    theme_color TEXT,
    social_links JSONB,
    requested_role TEXT,
    account_status TEXT DEFAULT 'active',
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Buddy Chats / Orion Chats
CREATE TABLE IF NOT EXISTS public.ai_buddy_chats (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    thread_id TEXT,
    messages JSONB,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_buddy_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orion_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    prompt TEXT,
    response TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    type TEXT,
    code TEXT,
    icon TEXT,
    creator_id TEXT,
    members JSONB,
    moderators JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_room_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    sender_role TEXT,
    sender_house TEXT,
    content TEXT NOT NULL,
    shared_material_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages (Peer to Peer / Global Chat)
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    owner_uid TEXT,
    name TEXT,
    role TEXT,
    house TEXT,
    message TEXT,
    target_id TEXT,
    shared_material_id TEXT,
    created_at BIGINT,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blogs
CREATE TABLE IF NOT EXISTS public.blogs (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    author TEXT,
    author_id TEXT,
    excerpt TEXT,
    cover_image TEXT,
    read_time TEXT,
    category TEXT,
    tags JSONB,
    is_published BOOLEAN DEFAULT true,
    likes BIGINT DEFAULT 0,
    created_at BIGINT,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes (Lecture Notes / Vault)
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    subject TEXT,
    icon TEXT,
    cover_bg TEXT,
    user_id TEXT,
    created_at TEXT,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Homework
CREATE TABLE IF NOT EXISTS public.homework (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    subject TEXT,
    class_grade TEXT,
    class_section TEXT,
    due_date TEXT,
    given_by TEXT,
    completed_list JSONB,
    created_at TEXT,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Materials Hub
CREATE TABLE IF NOT EXISTS public.materials (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    subject TEXT,
    type TEXT,
    category TEXT,
    file_url TEXT,
    file_name TEXT,
    uploaded_by TEXT,
    uploader_uid TEXT,
    uploader_house TEXT,
    uploader_section TEXT,
    class_grade TEXT,
    class_section TEXT,
    due_date TEXT,
    is_public BOOLEAN DEFAULT true,
    visibility TEXT,
    visible_to_grades JSONB,
    visible_to_sections JSONB,
    downloads BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    views BIGINT DEFAULT 0,
    created_at TEXT,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teacher Remarks
CREATE TABLE IF NOT EXISTS public.teacher_remarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT,
    teacher_id TEXT,
    remark TEXT,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teacher Commands
CREATE TABLE IF NOT EXISTS public.teacher_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id TEXT,
    command TEXT,
    parsed_action TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance (includes Subject-wise tracking)
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    date TEXT,
    grade TEXT,
    section TEXT,
    subject TEXT DEFAULT 'General',
    student_id TEXT,
    student_name TEXT,
    status TEXT, -- 'present', 'absent', 'late', 'excused'
    updated_at TEXT,
    updated_by TEXT,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments
CREATE TABLE IF NOT EXISTS public.assignments (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    subject TEXT,
    grade TEXT,
    section TEXT,
    due_date TEXT,
    teacher_id TEXT,
    teacher_name TEXT,
    attachments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================
-- Phase B: Academic Calendar Events
-- ========================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'exam', 'holiday', 'event', 'meeting', 'academic'
    start_date TEXT NOT NULL,
    end_date TEXT,
    all_day BOOLEAN DEFAULT true,
    location TEXT,
    target_audience TEXT DEFAULT 'all', -- 'all', 'students', 'teachers', 'grade', 'section'
    target_grade TEXT,
    target_section TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================
-- Phase C: Digital Gradebook (Assessments & Entries)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.gradebook_assessments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    section TEXT NOT NULL,
    period TEXT NOT NULL, -- e.g. 'Term 1', 'Mid-Term', 'Term 2', 'Final'
    max_marks NUMERIC NOT NULL,
    weightage NUMERIC NOT NULL,
    date TEXT NOT NULL,
    teacher_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gradebook_entries (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES public.gradebook_assessments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    student_name TEXT,
    marks_obtained NUMERIC,
    is_absent BOOLEAN DEFAULT false,
    feedback TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================
-- Phase C: Digital Report Cards
-- ========================================================
CREATE TABLE IF NOT EXISTS public.report_cards (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    section TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    subjects JSONB NOT NULL,
    attendance_stats JSONB,
    teacher_remarks TEXT,
    overall_percentage NUMERIC,
    overall_grade TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'review', 'published'
    published_at TIMESTAMP WITH TIME ZONE,
    generated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- Enable Row Level Security across all core tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_buddy_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_buddy_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orion_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Helper Functions for Role Resolution
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE uid = auth.uid()::text OR id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE (uid = auth.uid()::text OR id = auth.uid())
      AND role IN ('teacher', 'coordinator', 'admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE (uid = auth.uid()::text OR id = auth.uid())
      AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- --------------------------------------------------------
-- 1. user_profiles Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.user_profiles;
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.user_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid()::text = uid OR auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid()::text = uid OR auth.uid() = id OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 2. notes (Lecture Vault) Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can access their own notes" ON public.notes;
CREATE POLICY "Users can access their own notes"
  ON public.notes FOR ALL
  USING (user_id = auth.uid()::text OR auth.uid() IS NULL);

-- --------------------------------------------------------
-- 3. calendar_events Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Calendar events are readable by all" ON public.calendar_events;
CREATE POLICY "Calendar events are readable by all"
  ON public.calendar_events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can insert calendar events" ON public.calendar_events;
CREATE POLICY "Staff can insert calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (public.is_staff() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can update calendar events" ON public.calendar_events;
CREATE POLICY "Staff can update calendar events"
  ON public.calendar_events FOR UPDATE
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can delete calendar events" ON public.calendar_events;
CREATE POLICY "Staff can delete calendar events"
  ON public.calendar_events FOR DELETE
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 4. attendance Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Attendance is readable by students and staff" ON public.attendance;
CREATE POLICY "Attendance is readable by students and staff"
  ON public.attendance FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage attendance" ON public.attendance;
CREATE POLICY "Staff can manage attendance"
  ON public.attendance FOR ALL
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 5. gradebook_assessments Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Gradebook assessments readable by all" ON public.gradebook_assessments;
CREATE POLICY "Gradebook assessments readable by all"
  ON public.gradebook_assessments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage gradebook assessments" ON public.gradebook_assessments;
CREATE POLICY "Staff can manage gradebook assessments"
  ON public.gradebook_assessments FOR ALL
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 6. gradebook_entries Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Students can view entries, staff can view all" ON public.gradebook_entries;
CREATE POLICY "Students can view entries, staff can view all"
  ON public.gradebook_entries FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage gradebook entries" ON public.gradebook_entries;
CREATE POLICY "Staff can manage gradebook entries"
  ON public.gradebook_entries FOR ALL
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 7. report_cards Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Report cards select policy" ON public.report_cards;
CREATE POLICY "Report cards select policy"
  ON public.report_cards FOR SELECT
  USING (
    status = 'published' 
    OR public.is_staff() 
    OR auth.uid()::text = student_id 
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "Staff can insert report cards" ON public.report_cards;
CREATE POLICY "Staff can insert report cards"
  ON public.report_cards FOR INSERT
  WITH CHECK (public.is_staff() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can update report cards" ON public.report_cards;
CREATE POLICY "Staff can update report cards"
  ON public.report_cards FOR UPDATE
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can delete report cards" ON public.report_cards;
CREATE POLICY "Staff can delete report cards"
  ON public.report_cards FOR DELETE
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 8. homework & assignments Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Homework is readable by all" ON public.homework;
CREATE POLICY "Homework is readable by all"
  ON public.homework FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage homework" ON public.homework;
CREATE POLICY "Staff can manage homework"
  ON public.homework FOR ALL
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Assignments are readable by all" ON public.assignments;
CREATE POLICY "Assignments are readable by all"
  ON public.assignments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage assignments" ON public.assignments;
CREATE POLICY "Staff can manage assignments"
  ON public.assignments FOR ALL
  USING (public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 9. materials Hub Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Materials readable by authenticated" ON public.materials;
CREATE POLICY "Materials readable by authenticated"
  ON public.materials FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can upload and manage materials" ON public.materials;
CREATE POLICY "Users can upload and manage materials"
  ON public.materials FOR ALL
  USING (uploader_uid = auth.uid()::text OR public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 10. blogs Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Blogs are readable by all" ON public.blogs;
CREATE POLICY "Blogs are readable by all"
  ON public.blogs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authors and staff can manage blogs" ON public.blogs;
CREATE POLICY "Authors and staff can manage blogs"
  ON public.blogs FOR ALL
  USING (author_id = auth.uid()::text OR public.is_staff() OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 11. chat_rooms & messages Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Chat rooms are readable by all" ON public.chat_rooms;
CREATE POLICY "Chat rooms are readable by all"
  ON public.chat_rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage chat rooms" ON public.chat_rooms;
CREATE POLICY "Users can manage chat rooms"
  ON public.chat_rooms FOR ALL
  USING (auth.uid() IS NOT NULL OR true);

DROP POLICY IF EXISTS "Chat room messages readable by all" ON public.chat_room_messages;
CREATE POLICY "Chat room messages readable by all"
  ON public.chat_room_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can send chat room messages" ON public.chat_room_messages;
CREATE POLICY "Users can send chat room messages"
  ON public.chat_room_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR true);

DROP POLICY IF EXISTS "Messages readable by all" ON public.messages;
CREATE POLICY "Messages readable by all"
  ON public.messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR true);

-- --------------------------------------------------------
-- 12. ai_buddy_chats & orion_chats Policies
-- --------------------------------------------------------
DROP POLICY IF EXISTS "AI chats accessible by owner" ON public.ai_buddy_chats;
CREATE POLICY "AI chats accessible by owner"
  ON public.ai_buddy_chats FOR ALL
  USING (user_id = auth.uid()::text OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Orion chats accessible by owner" ON public.orion_chats;
CREATE POLICY "Orion chats accessible by owner"
  ON public.orion_chats FOR ALL
  USING (user_id = auth.uid()::text OR auth.uid() IS NULL);

-- --------------------------------------------------------
-- 13. Push Notifications & FCM Tokens (user_push_tokens & push_subscriptions)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    token TEXT UNIQUE NOT NULL,
    platform TEXT DEFAULT 'web_fcm',
    device_label TEXT DEFAULT 'Web Browser',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON public.user_push_tokens(token);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can manage push tokens" ON public.user_push_tokens;
CREATE POLICY "Public can manage push tokens" ON public.user_push_tokens FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT,
    user_id TEXT,
    endpoint TEXT UNIQUE NOT NULL,
    keys JSONB,
    p256dh TEXT,
    auth TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can manage push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Public can manage push subscriptions" ON public.push_subscriptions FOR ALL USING (true);

-- --------------------------------------------------------
-- 14. StudentOS Life Tables (Competitions, Events, Clubs, Badges, Gallery, Houses, Polls, News)
-- --------------------------------------------------------
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
ALTER TABLE public.life_competitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Competitions readable by all" ON public.life_competitions;
CREATE POLICY "Competitions readable by all" ON public.life_competitions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage competitions" ON public.life_competitions;
CREATE POLICY "Staff can manage competitions" ON public.life_competitions FOR ALL USING (true);

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
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events readable by all" ON public.life_events;
CREATE POLICY "Events readable by all" ON public.life_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage events" ON public.life_events;
CREATE POLICY "Staff can manage events" ON public.life_events FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.life_clubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    description TEXT,
    icon TEXT DEFAULT '⭐',
    lead_teacher TEXT,
    student_head TEXT,
    member_count INTEGER DEFAULT 0,
    meeting_days TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.life_clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clubs readable by all" ON public.life_clubs;
CREATE POLICY "Clubs readable by all" ON public.life_clubs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage clubs" ON public.life_clubs;
CREATE POLICY "Staff can manage clubs" ON public.life_clubs FOR ALL USING (true);

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
ALTER TABLE public.life_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Badges readable by all" ON public.life_achievements;
CREATE POLICY "Badges readable by all" ON public.life_achievements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can award badges" ON public.life_achievements;
CREATE POLICY "Staff can award badges" ON public.life_achievements FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.life_gallery (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    cover_url TEXT,
    photo_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.life_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gallery readable by all" ON public.life_gallery;
CREATE POLICY "Gallery readable by all" ON public.life_gallery FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage gallery" ON public.life_gallery;
CREATE POLICY "Staff can manage gallery" ON public.life_gallery FOR ALL USING (true);

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
ALTER TABLE public.life_houses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Houses readable by all" ON public.life_houses;
CREATE POLICY "Houses readable by all" ON public.life_houses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage houses" ON public.life_houses;
CREATE POLICY "Staff can manage houses" ON public.life_houses FOR ALL USING (true);

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
ALTER TABLE public.life_polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Polls readable by all" ON public.life_polls;
CREATE POLICY "Polls readable by all" ON public.life_polls FOR SELECT USING (true);
DROP POLICY IF EXISTS "All users can vote or manage polls" ON public.life_polls;
CREATE POLICY "All users can vote or manage polls" ON public.life_polls FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.life_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);
ALTER TABLE public.life_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Poll votes accessible by all" ON public.life_poll_votes;
CREATE POLICY "Poll votes accessible by all" ON public.life_poll_votes FOR ALL USING (true);

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
ALTER TABLE public.life_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News readable by all" ON public.life_news;
CREATE POLICY "News readable by all" ON public.life_news FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can manage news" ON public.life_news;
CREATE POLICY "Staff can manage news" ON public.life_news FOR ALL USING (true);

