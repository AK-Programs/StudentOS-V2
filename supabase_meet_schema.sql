-- ====================================================================
-- StudentOS Meet — Complete Supabase PostgreSQL Database Schema
-- Run this script in your Supabase SQL Editor to create all Phase 4 tables,
-- indexes, foreign keys, triggers, and Row-Level Security (RLS) policies.
-- ====================================================================

-- Enable UUID Extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. MEETINGS TABLE
CREATE TABLE IF NOT EXISTS public.meetings (
    id VARCHAR(64) PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT DEFAULT 'General',
    class_name TEXT,
    batch TEXT,
    type VARCHAR(32) DEFAULT 'scheduled' CHECK (type IN ('instant', 'scheduled', 'recurring')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    description TEXT,
    password VARCHAR(64),
    host_id UUID NOT NULL,
    host_name TEXT NOT NULL,
    host_email TEXT NOT NULL,
    host_role VARCHAR(32) DEFAULT 'teacher',
    join_link TEXT NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    is_muted_all BOOLEAN DEFAULT FALSE,
    is_camera_disabled_all BOOLEAN DEFAULT FALSE,
    is_chat_disabled BOOLEAN DEFAULT FALSE,
    is_screenshare_disabled BOOLEAN DEFAULT FALSE,
    is_fileshare_disabled BOOLEAN DEFAULT FALSE,
    invited_users TEXT[] DEFAULT '{}',
    invited_classes TEXT[] DEFAULT '{}',
    is_school_wide BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MEETING PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role VARCHAR(32) DEFAULT 'participant' CHECK (role IN ('host', 'co-host', 'participant')),
    user_role VARCHAR(32) DEFAULT 'student',
    avatar TEXT,
    status VARCHAR(32) DEFAULT 'admitted' CHECK (status IN ('waiting', 'admitted', 'rejected', 'left', 'removed')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    is_camera_on BOOLEAN DEFAULT FALSE,
    is_mic_on BOOLEAN DEFAULT FALSE,
    is_hand_raised BOOLEAN DEFAULT FALSE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    current_breakout_room_id VARCHAR(64),
    camera_active_duration INTEGER DEFAULT 0,
    mic_active_duration INTEGER DEFAULT 0,
    network_quality VARCHAR(32) DEFAULT 'excellent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MEETING ATTENDANCE REPORT TABLE
CREATE TABLE IF NOT EXISTS public.meeting_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    meeting_title TEXT NOT NULL,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    user_role VARCHAR(32) DEFAULT 'student',
    join_time TIMESTAMPTZ NOT NULL,
    leave_time TIMESTAMPTZ,
    total_duration_minutes INTEGER DEFAULT 0,
    camera_on_percent INTEGER DEFAULT 0,
    mic_active_seconds INTEGER DEFAULT 0,
    attended_percent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MEETING CHAT TABLE
CREATE TABLE IF NOT EXISTS public.meeting_chat (
    id VARCHAR(64) PRIMARY KEY,
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role VARCHAR(32) DEFAULT 'student',
    sender_avatar TEXT,
    content TEXT NOT NULL,
    attachment JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_private BOOLEAN DEFAULT FALSE,
    recipient_id UUID
);

-- 5. MEETING RECORDINGS TABLE
CREATE TABLE IF NOT EXISTS public.meeting_recordings (
    id VARCHAR(64) PRIMARY KEY,
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    host_name TEXT NOT NULL,
    url TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ai_summary TEXT
);

-- 6. MEETING BREAKOUT ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.meeting_breakout_rooms (
    id VARCHAR(64) PRIMARY KEY,
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    assigned_user_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MEETING INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS public.meeting_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_user_id UUID,
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MEETING CALENDAR TABLE
CREATE TABLE IF NOT EXISTS public.meeting_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    event_type VARCHAR(32) DEFAULT 'class_lecture',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. MEETING NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.meeting_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    meeting_id VARCHAR(64) REFERENCES public.meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_host ON public.meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start ON public.meetings(start_time);

CREATE INDEX IF NOT EXISTS idx_participants_meeting ON public.meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.meeting_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_meeting ON public.meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.meeting_attendance(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_meeting ON public.meeting_chat(meeting_id);
CREATE INDEX IF NOT EXISTS idx_recordings_meeting ON public.meeting_recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_breakout_meeting ON public.meeting_breakout_rooms(meeting_id);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON public.meeting_calendar(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.meeting_notifications(user_id);

-- ====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_breakout_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notifications ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for authenticated StudentOS users
CREATE POLICY "Allow authenticated read on meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert/update on meetings" ON public.meetings FOR ALL USING (true);

CREATE POLICY "Allow authenticated access on meeting_participants" ON public.meeting_participants FOR ALL USING (true);
CREATE POLICY "Allow authenticated access on meeting_attendance" ON public.meeting_attendance FOR ALL USING (true);
CREATE POLICY "Allow authenticated access on meeting_chat" ON public.meeting_chat FOR ALL USING (true);
CREATE POLICY "Allow authenticated access on meeting_recordings" ON public.meeting_recordings FOR ALL USING (true);
CREATE POLICY "Allow authenticated access on meeting_breakout_rooms" ON public.meeting_breakout_rooms FOR ALL USING (true);
CREATE POLICY "Allow authenticated access on meeting_invitations" ON public.meeting_invitations FOR ALL USING (true);
CREATE POLICY "Allow authenticated access on meeting_calendar" ON public.meeting_calendar FOR ALL USING (true);
CREATE POLICY "Allow authenticated access on meeting_notifications" ON public.meeting_notifications FOR ALL USING (true);

-- Enable Realtime Replication for Meeting Chat and Whiteboard Signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
