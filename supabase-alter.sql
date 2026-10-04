-- Add missing columns to existing tables
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at BIGINT;
ALTER TABLE public.ai_buddy_chats ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.ai_buddy_chats ADD COLUMN IF NOT EXISTS attached_files JSONB DEFAULT '[]'::jsonb;

-- Create chat_rooms table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access for chat_rooms" ON public.chat_rooms;
CREATE POLICY "Allow public access for chat_rooms" ON public.chat_rooms FOR ALL USING (true) WITH CHECK (true);
