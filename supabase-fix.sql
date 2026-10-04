-- Fix ai_buddy_chats
DROP TABLE IF EXISTS public.ai_buddy_chats CASCADE;
CREATE TABLE public.ai_buddy_chats (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    persona_id TEXT,
    mode TEXT,
    messages JSONB,
    attached_files JSONB,
    created_at BIGINT
);

-- Fix messages
DROP TABLE IF EXISTS public.messages CASCADE;
CREATE TABLE public.messages (
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

-- Fix chat_rooms
DROP TABLE IF EXISTS public.chat_rooms CASCADE;
CREATE TABLE public.chat_rooms (
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

-- Fix notes
DROP TABLE IF EXISTS public.notes CASCADE;
CREATE TABLE public.notes (
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

-- Fix homework
DROP TABLE IF EXISTS public.homework CASCADE;
CREATE TABLE public.homework (
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

-- Turn off RLS for testing
ALTER TABLE public.ai_buddy_chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework DISABLE ROW LEVEL SECURITY;
