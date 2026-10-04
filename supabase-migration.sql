-- StudentOS Supabase Migration Script
-- Copy and run this script in your Supabase SQL Editor (https://supabase.com)

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the "users" table with the exact requested architecture
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  class TEXT DEFAULT 'Grade 10',
  section TEXT DEFAULT 'Solara',
  house TEXT DEFAULT 'Ruby',
  profile_image TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create indexes for high performance lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. Enable Row Level Security (RLS) to ensure structure compliance
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. Create Public/Anon RLS Policies
-- Note: Because client-side queries use the public anon key (since user logins are authenticated via Firebase Auth),
-- we authorize access across both authenticated and anon roles to prevent PGRST205/insufficient permission errors.

DROP POLICY IF EXISTS "Allow public select" ON users;
DROP POLICY IF EXISTS "Allow public insert" ON users;
DROP POLICY IF EXISTS "Allow public update" ON users;
DROP POLICY IF EXISTS "Allow public delete" ON users;

CREATE POLICY "Allow public select" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);

-- (Optional) Alternatively, if you wish to bypass RLS entirely for extreme simplicity:
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 5. Create "ai_buddy_chats" table
CREATE TABLE IF NOT EXISTS ai_buddy_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  attached_files JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_buddy_chats_user_id ON ai_buddy_chats(user_id);
ALTER TABLE ai_buddy_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for ai_buddy_chats" ON ai_buddy_chats;
CREATE POLICY "Allow public access for ai_buddy_chats" ON ai_buddy_chats FOR ALL USING (true) WITH CHECK (true);

-- 6. Create "chat_rooms" table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for chat_rooms" ON chat_rooms;
CREATE POLICY "Allow public access for chat_rooms" ON chat_rooms FOR ALL USING (true) WITH CHECK (true);

-- 7. Create "messages" table (Peer to Peer messaging)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  house TEXT,
  message TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  target_id TEXT,
  shared_material_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_owner_uid ON messages(owner_uid);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for messages" ON messages;
CREATE POLICY "Allow public access for messages" ON messages FOR ALL USING (true) WITH CHECK (true);


-- 8. Create "materials" table
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT,
  category TEXT,
  type TEXT,
  url TEXT,
  file_url TEXT,
  attachment_url TEXT,
  storage_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  description TEXT,
  uploaded_by TEXT,
  uploader_uid TEXT,
  uploader_house TEXT,
  uploader_section TEXT,
  created_at BIGINT,
  created_at_date TEXT,
  class_grade TEXT,
  class_section TEXT,
  due_date TEXT,
  is_public BOOLEAN,
  visibility TEXT,
  visible_to_grades JSONB DEFAULT '[]'::jsonb,
  visible_to_sections JSONB DEFAULT '[]'::jsonb,
  visible_to_houses JSONB DEFAULT '[]'::jsonb,
  downloads INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  liked_by JSONB DEFAULT '[]'::jsonb,
  views INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  comments JSONB DEFAULT '[]'::jsonb,
  question_paper_year TEXT,
  ai_summary TEXT,
  ai_quiz TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for materials" ON public.materials;
CREATE POLICY "Allow public access for materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);


-- 9. Create "assignments" table
CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  description TEXT,
  type TEXT,
  resource_type TEXT,
  target_grade TEXT,
  class TEXT,
  target_section TEXT,
  section TEXT,
  url TEXT,
  file_url TEXT,
  file_data TEXT,
  storage_path TEXT,
  gallery_urls JSONB DEFAULT '[]'::jsonb,
  file_name TEXT,
  created_at BIGINT,
  author TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for assignments" ON public.assignments;
CREATE POLICY "Allow public access for assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);


-- 10. Create "school_resources" table
CREATE TABLE IF NOT EXISTS public.school_resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  description TEXT,
  type TEXT,
  resource_type TEXT,
  target_grade TEXT,
  class TEXT,
  target_section TEXT,
  section TEXT,
  url TEXT,
  file_url TEXT,
  file_data TEXT,
  storage_path TEXT,
  gallery_urls JSONB DEFAULT '[]'::jsonb,
  file_name TEXT,
  created_at BIGINT,
  author TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.school_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for school_resources" ON public.school_resources;
CREATE POLICY "Allow public access for school_resources" ON public.school_resources FOR ALL USING (true) WITH CHECK (true);


-- 11. Create "attendance" table
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for attendance" ON public.attendance;
CREATE POLICY "Allow public access for attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);


