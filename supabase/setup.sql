-- ============================================================
-- StudentOS Supabase Database Setup
-- Run this in your Supabase SQL Editor once to set up all tables
-- and RLS policies for the demo environment.
-- ============================================================

-- ==================== MATERIALS TABLE ====================
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  category TEXT,
  type TEXT NOT NULL DEFAULT '',
  url TEXT,
  file_url TEXT,
  attachment_url TEXT,
  storage_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  description TEXT DEFAULT '',
  uploaded_by TEXT DEFAULT '',
  uploader_uid TEXT,
  uploader_house TEXT,
  uploader_section TEXT,
  created_at BIGINT DEFAULT 0,
  created_at_date TEXT,
  class_grade TEXT,
  class_section TEXT,
  due_date TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  visibility TEXT DEFAULT 'student',
  visible_to_grades TEXT[] DEFAULT '{}',
  visible_to_sections TEXT[] DEFAULT '{}',
  visible_to_houses TEXT[] DEFAULT '{}',
  downloads INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  liked_by TEXT[] DEFAULT '{}',
  views INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT FALSE,
  comments JSONB DEFAULT '[]',
  question_paper_year TEXT,
  ai_summary TEXT,
  ai_quiz JSONB,
  raw_data JSONB
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_materials" ON public.materials;
CREATE POLICY "allow_all_materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

-- ==================== ASSIGNMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'assignment',
  resource_type TEXT DEFAULT 'assignment',
  target_grade TEXT DEFAULT 'All Grades',
  class TEXT DEFAULT 'All Grades',
  target_section TEXT DEFAULT 'All Sections',
  section TEXT DEFAULT 'All Sections',
  url TEXT,
  file_url TEXT,
  file_data TEXT,
  storage_path TEXT,
  gallery_urls JSONB DEFAULT '[]',
  file_name TEXT,
  created_at BIGINT DEFAULT 0,
  author TEXT DEFAULT 'Teacher',
  raw_data JSONB
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_assignments" ON public.assignments;
CREATE POLICY "allow_all_assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);

-- ==================== SCHOOL RESOURCES TABLE ====================
CREATE TABLE IF NOT EXISTS public.school_resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'resource',
  resource_type TEXT DEFAULT 'resource',
  target_grade TEXT DEFAULT 'All Grades',
  class TEXT DEFAULT 'All Grades',
  target_section TEXT DEFAULT 'All Sections',
  section TEXT DEFAULT 'All Sections',
  url TEXT,
  file_url TEXT,
  file_data TEXT,
  storage_path TEXT,
  gallery_urls JSONB DEFAULT '[]',
  file_name TEXT,
  created_at BIGINT DEFAULT 0,
  author TEXT DEFAULT 'Teacher',
  raw_data JSONB
);

ALTER TABLE public.school_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_school_resources" ON public.school_resources;
CREATE POLICY "allow_all_school_resources" ON public.school_resources FOR ALL USING (true) WITH CHECK (true);

-- ==================== AI BUDDY CHATS TABLE ====================
CREATE TABLE IF NOT EXISTS public.ai_buddy_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT '',
  persona_id TEXT DEFAULT 'study_buddy',
  mode TEXT DEFAULT 'explanatory',
  messages JSONB DEFAULT '[]',
  attached_files JSONB DEFAULT '[]',
  created_at BIGINT DEFAULT 0
);

ALTER TABLE public.ai_buddy_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_ai_buddy_chats" ON public.ai_buddy_chats;
CREATE POLICY "allow_all_ai_buddy_chats" ON public.ai_buddy_chats FOR ALL USING (true) WITH CHECK (true);

-- ==================== MESSAGES TABLE (Global Chat) ====================
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  owner_uid TEXT DEFAULT '',
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'student',
  house TEXT,
  message TEXT NOT NULL DEFAULT '',
  created_at BIGINT DEFAULT 0,
  target_id TEXT,
  shared_material_id TEXT
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_messages" ON public.messages;
CREATE POLICY "allow_all_messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- ==================== CHAT ROOMS TABLE ====================
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT ''
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_chat_rooms" ON public.chat_rooms;
CREATE POLICY "allow_all_chat_rooms" ON public.chat_rooms FOR ALL USING (true) WITH CHECK (true);

-- ==================== CHAT ROOM MESSAGES TABLE ====================
CREATE TABLE IF NOT EXISTS public.chat_room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL DEFAULT '',
  sender_uid TEXT DEFAULT '',
  sender_name TEXT DEFAULT '',
  sender_role TEXT DEFAULT 'student',
  sender_house TEXT,
  message TEXT NOT NULL DEFAULT '',
  created_at BIGINT DEFAULT 0,
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_name TEXT
);

ALTER TABLE public.chat_room_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_chat_room_messages" ON public.chat_room_messages;
CREATE POLICY "allow_all_chat_room_messages" ON public.chat_room_messages FOR ALL USING (true) WITH CHECK (true);

-- ==================== CHAT ROOM MEMBERS TABLE ====================
CREATE TABLE IF NOT EXISTS public.chat_room_members (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  joined_at BIGINT DEFAULT 0
);

ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_chat_room_members" ON public.chat_room_members;
CREATE POLICY "allow_all_chat_room_members" ON public.chat_room_members FOR ALL USING (true) WITH CHECK (true);

-- ==================== ORION CHATS TABLE ====================
CREATE TABLE IF NOT EXISTS public.orion_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt TEXT DEFAULT '',
  response TEXT DEFAULT '',
  timestamp TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0
);

ALTER TABLE public.orion_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_orion_chats" ON public.orion_chats;
CREATE POLICY "allow_all_orion_chats" ON public.orion_chats FOR ALL USING (true) WITH CHECK (true);

-- ==================== TEACHER COMMANDS TABLE ====================
CREATE TABLE IF NOT EXISTS public.teacher_commands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  command_text TEXT DEFAULT '',
  recognized_at TEXT DEFAULT '',
  parsed_action TEXT DEFAULT '',
  status TEXT DEFAULT 'completed',
  created_at BIGINT DEFAULT 0
);

ALTER TABLE public.teacher_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_teacher_commands" ON public.teacher_commands;
CREATE POLICY "allow_all_teacher_commands" ON public.teacher_commands FOR ALL USING (true) WITH CHECK (true);

-- ==================== GLOBAL DATA TABLE ====================
CREATE TABLE IF NOT EXISTS public.global_data (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TEXT DEFAULT ''
);

ALTER TABLE public.global_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_global_data" ON public.global_data;
CREATE POLICY "allow_all_global_data" ON public.global_data FOR ALL USING (true) WITH CHECK (true);

-- ==================== NOTIFICATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  message TEXT DEFAULT '',
  content TEXT DEFAULT '',
  type TEXT DEFAULT 'announcement',
  created_at TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  target_user_id TEXT DEFAULT 'all',
  user_id TEXT,
  target_class TEXT,
  link_tab TEXT,
  link TEXT,
  meta JSONB
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_notifications" ON public.notifications;
CREATE POLICY "allow_all_notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- ==================== AI BUDDY MESSAGES TABLE ====================
CREATE TABLE IF NOT EXISTS public.ai_buddy_messages (
  id SERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  content TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0
);

ALTER TABLE public.ai_buddy_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_ai_buddy_messages" ON public.ai_buddy_messages;
CREATE POLICY "allow_all_ai_buddy_messages" ON public.ai_buddy_messages FOR ALL USING (true) WITH CHECK (true);

-- ==================== BLOGS TABLE ====================
CREATE TABLE IF NOT EXISTS public.blogs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  author TEXT DEFAULT '',
  author_id TEXT,
  category TEXT DEFAULT 'General',
  created_at TEXT DEFAULT '',
  is_published BOOLEAN DEFAULT true,
  likes INTEGER DEFAULT 0,
  raw_data JSONB
);

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_blogs" ON public.blogs;
CREATE POLICY "allow_all_blogs" ON public.blogs FOR ALL USING (true) WITH CHECK (true);

-- ==================== LECTURE NOTES & NOTES TABLE ====================
CREATE TABLE IF NOT EXISTS public.lecture_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  user_id TEXT,
  author TEXT,
  updated_at TEXT DEFAULT ''
);

ALTER TABLE public.lecture_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_lecture_notes" ON public.lecture_notes;
CREATE POLICY "allow_all_lecture_notes" ON public.lecture_notes FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  subject TEXT DEFAULT 'General',
  created_at TEXT DEFAULT ''
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_notes" ON public.notes;
CREATE POLICY "allow_all_notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);

-- ==================== SPORTS ACTIVITIES TABLE ====================
CREATE TABLE IF NOT EXISTS public.sports_activities (
  id TEXT PRIMARY KEY,
  data TEXT DEFAULT '{}'
);

ALTER TABLE public.sports_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_sports_activities" ON public.sports_activities;
CREATE POLICY "allow_all_sports_activities" ON public.sports_activities FOR ALL USING (true) WITH CHECK (true);

-- ==================== SUBSTITUTE HUB TABLE ====================
CREATE TABLE IF NOT EXISTS public.substitute_hub (
  id TEXT PRIMARY KEY,
  data TEXT DEFAULT '{}'
);

ALTER TABLE public.substitute_hub ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_substitute_hub" ON public.substitute_hub;
CREATE POLICY "allow_all_substitute_hub" ON public.substitute_hub FOR ALL USING (true) WITH CHECK (true);

-- ==================== TEACHER REMARKS TABLE ====================
CREATE TABLE IF NOT EXISTS public.teacher_remarks (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL DEFAULT '',
  teacher_id TEXT NOT NULL DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT ''
);

ALTER TABLE public.teacher_remarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_teacher_remarks" ON public.teacher_remarks;
CREATE POLICY "allow_all_teacher_remarks" ON public.teacher_remarks FOR ALL USING (true) WITH CHECK (true);

-- ==================== USER PROFILES TABLE ====================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE,
  name TEXT DEFAULT '',
  email TEXT,
  role TEXT DEFAULT 'student',
  requested_role TEXT,
  account_status TEXT DEFAULT 'approved',
  grade TEXT,
  section TEXT,
  house TEXT,
  department TEXT,
  subjects TEXT[] DEFAULT '{}',
  specialty_subject TEXT,
  designation TEXT,
  photo_url TEXT,
  bio TEXT,
  points INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  raw_data JSONB,
  created_at BIGINT DEFAULT 0,
  updated_at BIGINT DEFAULT 0
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_user_profiles" ON public.user_profiles;
CREATE POLICY "allow_all_user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

-- ==================== GRADEBOOK ASSESSMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS public.gradebook_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL DEFAULT '',
  class_grade TEXT NOT NULL DEFAULT 'Grade 10',
  class_section TEXT NOT NULL DEFAULT 'Solara',
  subject TEXT NOT NULL DEFAULT 'Mathematics',
  period TEXT NOT NULL DEFAULT 'Term 1',
  type TEXT NOT NULL DEFAULT 'Quiz',
  max_score NUMERIC NOT NULL DEFAULT 100,
  date TEXT NOT NULL DEFAULT '',
  teacher_id TEXT DEFAULT '',
  teacher_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gradebook_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_gradebook_assessments" ON public.gradebook_assessments;
CREATE POLICY "allow_all_gradebook_assessments" ON public.gradebook_assessments FOR ALL USING (true) WITH CHECK (true);

-- ==================== GRADEBOOK ENTRIES TABLE ====================
CREATE TABLE IF NOT EXISTS public.gradebook_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assessment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  score NUMERIC DEFAULT 0,
  max_score NUMERIC DEFAULT 100,
  percentage NUMERIC DEFAULT 0,
  letter_grade TEXT DEFAULT 'F',
  comment TEXT DEFAULT '',
  updated_at TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  UNIQUE(assessment_id, student_id)
);

ALTER TABLE public.gradebook_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_gradebook_entries" ON public.gradebook_entries;
CREATE POLICY "allow_all_gradebook_entries" ON public.gradebook_entries FOR ALL USING (true) WITH CHECK (true);

-- ==================== REPORT CARDS TABLE ====================
CREATE TABLE IF NOT EXISTS public.report_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT NOT NULL,
  student_name TEXT DEFAULT '',
  student_email TEXT DEFAULT '',
  roll_number TEXT DEFAULT '',
  class_grade TEXT DEFAULT 'Grade 10',
  class_section TEXT DEFAULT 'Solara',
  house TEXT DEFAULT '',
  academic_period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  subjects JSONB DEFAULT '[]',
  total_marks NUMERIC DEFAULT 0,
  max_total_marks NUMERIC DEFAULT 0,
  overall_percentage NUMERIC DEFAULT 0,
  overall_grade TEXT DEFAULT 'F',
  gpa NUMERIC DEFAULT 0,
  rank TEXT DEFAULT '',
  attendance_summary JSONB DEFAULT '{}',
  teacher_remarks TEXT DEFAULT '',
  principal_remarks TEXT DEFAULT '',
  conduct_grade TEXT DEFAULT 'Exemplary',
  generated_at TEXT DEFAULT '',
  published_at TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  UNIQUE(student_id, academic_period)
);

ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_report_cards" ON public.report_cards;
CREATE POLICY "allow_all_report_cards" ON public.report_cards FOR ALL USING (true) WITH CHECK (true);

-- ==================== CALENDAR EVENTS TABLE ====================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Academic',
  target_audience TEXT NOT NULL DEFAULT 'All',
  target_grades TEXT[] DEFAULT '{}',
  target_sections TEXT[] DEFAULT '{}',
  color TEXT DEFAULT '#4f46e5',
  is_mandatory BOOLEAN DEFAULT false,
  created_by TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_calendar_events" ON public.calendar_events;
CREATE POLICY "allow_all_calendar_events" ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);

-- ==================== ATTENDANCE TABLE ====================
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  class_grade TEXT,
  class_section TEXT,
  marked_by TEXT,
  timestamp BIGINT DEFAULT 0
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_attendance" ON public.attendance;
CREATE POLICY "allow_all_attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- ==================== PUSH SUBSCRIPTIONS TABLE ====================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_role TEXT,
  subscription JSONB NOT NULL,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "allow_all_push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ==================== STORAGE BUCKET ====================
-- Ensure the StudentOS bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('StudentOS', 'StudentOS', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow all storage operations on the bucket
DROP POLICY IF EXISTS "allow_all_uploads" ON storage.objects;
CREATE POLICY "allow_all_uploads" ON storage.objects FOR ALL USING (bucket_id = 'StudentOS') WITH CHECK (bucket_id = 'StudentOS');

-- ==================== SYSTEM UPDATES TABLE ====================
CREATE TABLE IF NOT EXISTS public.system_updates (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'feature',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',
  audience_roles TEXT[] DEFAULT '{"all"}',
  is_major_release BOOLEAN DEFAULT false,
  action_url TEXT,
  action_label TEXT,
  media_urls JSONB DEFAULT '[]',
  author_id TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT 'Super Administrator',
  author_role TEXT DEFAULT 'super_admin',
  scheduled_publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_system_updates_status ON public.system_updates(status);
CREATE INDEX IF NOT EXISTS idx_system_updates_published_at ON public.system_updates(published_at DESC);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_system_updates" ON public.system_updates;
CREATE POLICY "allow_all_system_updates" ON public.system_updates FOR ALL USING (true) WITH CHECK (true);

-- ==================== SYSTEM UPDATE READS TABLE ====================
CREATE TABLE IF NOT EXISTS public.system_update_reads (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_update_user_read UNIQUE (update_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_system_update_reads_user ON public.system_update_reads(user_id);

ALTER TABLE public.system_update_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_system_update_reads" ON public.system_update_reads;
CREATE POLICY "allow_all_system_update_reads" ON public.system_update_reads FOR ALL USING (true) WITH CHECK (true);

-- ==================== SYSTEM UPDATE AUDIT LOGS ====================
CREATE TABLE IF NOT EXISTS public.system_update_audit_logs (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'super_admin',
  timestamp TIMESTAMPTZ DEFAULT now(),
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_update_audit_logs_timestamp ON public.system_update_audit_logs(timestamp DESC);

ALTER TABLE public.system_update_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_system_update_audit_logs" ON public.system_update_audit_logs;
CREATE POLICY "allow_all_system_update_audit_logs" ON public.system_update_audit_logs FOR ALL USING (true) WITH CHECK (true);
