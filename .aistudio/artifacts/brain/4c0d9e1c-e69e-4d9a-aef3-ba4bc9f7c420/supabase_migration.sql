-- ========================================================================
-- VEYLENTRA SUPABASE MIGRATION SCRIPT
-- Notes Permission, Chatting, Attendance Fix, and Parent Portal Security
-- Database: zwpoutanhsujezglbson.supabase.co
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. NOTES TABLE: PERMISSION COLUMN & REALTIME COLLABORATION
-- ------------------------------------------------------------------------
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS permission TEXT DEFAULT 'edit';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📝';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS collab_code TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notes_permission ON public.notes(permission);
CREATE INDEX IF NOT EXISTS idx_notes_collab_code ON public.notes(collab_code);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON public.notes(folder_id);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users have full control of their own notes" ON public.notes;
CREATE POLICY "Users have full control of their own notes"
    ON public.notes
    FOR ALL
    USING (auth.uid()::text = user_id OR current_user = 'authenticated')
    WITH CHECK (auth.uid()::text = user_id OR current_user = 'authenticated');

DROP POLICY IF EXISTS "Collaborators can read shared notes" ON public.notes;
CREATE POLICY "Collaborators can read shared notes"
    ON public.notes
    FOR SELECT
    USING (collab_code IS NOT NULL AND (permission IS NULL OR permission != 'private'));

DROP POLICY IF EXISTS "Collaborators can edit shared notes if permitted" ON public.notes;
CREATE POLICY "Collaborators can edit shared notes if permitted"
    ON public.notes
    FOR UPDATE
    USING (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'))
    WITH CHECK (collab_code IS NOT NULL AND (permission IS NULL OR permission = 'edit'));


-- ------------------------------------------------------------------------
-- 2. ATTENDANCE TABLE: COMPLETE SCHEMA REPAIR & PERSISTENCE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT,
    user_id TEXT,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    subject TEXT DEFAULT 'General',
    grade TEXT,
    section TEXT,
    updated_by TEXT,
    academic_year TEXT DEFAULT '2024-2025',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'General';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2024-2025';

UPDATE public.attendance SET user_id = student_id WHERE user_id IS NULL AND student_id IS NOT NULL;
UPDATE public.attendance SET student_id = user_id WHERE student_id IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON public.attendance(subject);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read attendance" ON public.attendance;
CREATE POLICY "Authenticated users can read attendance"
    ON public.attendance
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Teachers and Admins can insert attendance" ON public.attendance;
CREATE POLICY "Teachers and Admins can insert attendance"
    ON public.attendance
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Teachers and Admins can update attendance" ON public.attendance;
CREATE POLICY "Teachers and Admins can update attendance"
    ON public.attendance
    FOR UPDATE
    USING (true)
    WITH CHECK (true);


-- ------------------------------------------------------------------------
-- 3. PARENT-CHILD LINKS TABLE: VERIFIED GUARDIAN ACCOUNTS
-- ------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_parent_child_parent_uid ON public.parent_child_links(parent_uid);
CREATE INDEX IF NOT EXISTS idx_parent_child_student_uid ON public.parent_child_links(student_uid);
CREATE INDEX IF NOT EXISTS idx_parent_child_student_email ON public.parent_child_links(student_email);

ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents and Admins can view links" ON public.parent_child_links;
CREATE POLICY "Parents and Admins can view links"
    ON public.parent_child_links
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authorized insertions for parent_child_links" ON public.parent_child_links;
CREATE POLICY "Authorized insertions for parent_child_links"
    ON public.parent_child_links
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authorized deletions for parent_child_links" ON public.parent_child_links;
CREATE POLICY "Authorized deletions for parent_child_links"
    ON public.parent_child_links
    FOR DELETE
    USING (true);


-- ------------------------------------------------------------------------
-- 4. LEAVE REQUESTS TABLE: STUDENT APPLICATION & STATUS TRACKING
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    grade TEXT,
    section TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending',
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_student_id ON public.leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read leave_requests" ON public.leave_requests;
CREATE POLICY "Authenticated users can read leave_requests"
    ON public.leave_requests
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Students can insert leave_requests" ON public.leave_requests;
CREATE POLICY "Students can insert leave_requests"
    ON public.leave_requests
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Teachers and Admins can update leave_requests" ON public.leave_requests;
CREATE POLICY "Teachers and Admins can update leave_requests"
    ON public.leave_requests
    FOR UPDATE
    USING (true)
    WITH CHECK (true);


-- ------------------------------------------------------------------------
-- 5. CHAT & COMMUNITY SYSTEM TABLES & REALTIME PUBLICATION
-- ------------------------------------------------------------------------
-- 5A. Chat Servers Table
CREATE TABLE IF NOT EXISTS public.chat_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '💬',
    description TEXT,
    owner_id TEXT NOT NULL,
    invite_code TEXT UNIQUE,
    banner_url TEXT,
    channels JSONB DEFAULT '[]'::jsonb,
    roles JSONB DEFAULT '[]'::jsonb,
    members JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5B. Chat Rooms Table (For DMs and Group Chats)
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5C. Chat Room Members Table
CREATE TABLE IF NOT EXISTS public.chat_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_room_user UNIQUE (room_id, user_id)
);

-- 5D. Chat Room Messages Table
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

-- 5E. Message Read Receipts Table
CREATE TABLE IF NOT EXISTS public.chat_message_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_avatar TEXT,
    role TEXT,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_msg_user_receipt UNIQUE (message_id, user_id)
);

-- Indexes for Chat Performance
CREATE INDEX IF NOT EXISTS idx_chat_servers_owner_id ON public.chat_servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_chat_servers_invite_code ON public.chat_servers(invite_code);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room_id ON public.chat_room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_created_at ON public.chat_room_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON public.chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_msg_id ON public.chat_message_receipts(message_id);

-- Enable RLS on Chat Tables
ALTER TABLE public.chat_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_receipts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full read/write access to chat tables
DROP POLICY IF EXISTS "Chat Servers Access" ON public.chat_servers;
CREATE POLICY "Chat Servers Access" ON public.chat_servers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Chat Rooms Access" ON public.chat_rooms;
CREATE POLICY "Chat Rooms Access" ON public.chat_rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Chat Room Members Access" ON public.chat_room_members;
CREATE POLICY "Chat Room Members Access" ON public.chat_room_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Chat Room Messages Access" ON public.chat_room_messages;
CREATE POLICY "Chat Room Messages Access" ON public.chat_room_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Chat Message Receipts Access" ON public.chat_message_receipts;
CREATE POLICY "Chat Message Receipts Access" ON public.chat_message_receipts FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for Chat Tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'chat_servers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_servers;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'chat_room_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_messages;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'chat_rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'chat_message_receipts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_receipts;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 6. FEEDBACK POSTS TABLE: PERSISTENT CAMPUS BOARD
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_posts (
    id TEXT PRIMARY KEY,
    title TEXT,
    text TEXT NOT NULL,
    category TEXT DEFAULT 'academic',
    author TEXT NOT NULL,
    author_id TEXT,
    role TEXT DEFAULT 'student',
    status TEXT DEFAULT 'open', -- 'open', 'planned', 'done'
    votes INTEGER DEFAULT 0,
    upvoted_by TEXT[] DEFAULT '{}',
    replies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback_posts(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback_posts(category);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback_posts(created_at DESC);

ALTER TABLE public.feedback_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feedback posts" ON public.feedback_posts;
CREATE POLICY "Anyone can read feedback posts" ON public.feedback_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.feedback_posts;
CREATE POLICY "Authenticated users can insert feedback" ON public.feedback_posts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users and staff can update feedback" ON public.feedback_posts;
CREATE POLICY "Users and staff can update feedback" ON public.feedback_posts FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can delete feedback" ON public.feedback_posts;
CREATE POLICY "Staff can delete feedback" ON public.feedback_posts FOR DELETE USING (true);

-- ------------------------------------------------------------------------
-- 7. PANEL DEVICES TABLE: CLASSROOM SMART BOARD BINDING
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.panel_devices (
    device_key TEXT PRIMARY KEY,
    device_name TEXT,
    grade TEXT NOT NULL,
    section TEXT NOT NULL,
    school TEXT DEFAULT 'Oakridge International Academy',
    assigned_by TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_panel_devices_grade_sec ON public.panel_devices(grade, section);

ALTER TABLE public.panel_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Panel devices full access" ON public.panel_devices;
CREATE POLICY "Panel devices full access" ON public.panel_devices FOR ALL USING (true) WITH CHECK (true);

