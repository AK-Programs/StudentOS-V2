ALTER TABLE public.ai_buddy_chats ALTER COLUMN id SET DATA TYPE TEXT USING id::TEXT;
ALTER TABLE public.orion_chats ALTER COLUMN id SET DATA TYPE TEXT USING id::TEXT;
ALTER TABLE public.ai_buddy_chats ADD COLUMN IF NOT EXISTS attached_files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_buddy_chats ADD COLUMN IF NOT EXISTS mode TEXT;
ALTER TABLE public.ai_buddy_chats ADD COLUMN IF NOT EXISTS persona_id TEXT;
ALTER TABLE public.orion_chats ADD COLUMN IF NOT EXISTS action_executed TEXT;
