-- ========================================================
-- StudentOS: Flashcards, Decks & Per-User Study Progress (SM-2) Schema
-- ========================================================

-- 1. Create Flashcard Decks Table
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
    id TEXT PRIMARY KEY,
    user_id TEXT,                                 -- StudentOS User UID or 'system' for starter decks
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

-- 2. Create Flashcards Table (SuperMemo SM-2)
CREATE TABLE IF NOT EXISTS public.flashcards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
    user_id TEXT,
    front TEXT NOT NULL,                          -- Question / Concept Prompt
    back TEXT NOT NULL,                           -- Answer
    hint TEXT,                                    -- Optional retrieval hint
    explanation TEXT DEFAULT '',                  -- Optional detailed explanation
    tags JSONB DEFAULT '[]'::jsonb,
    interval INT DEFAULT 0,                       -- Interval in days
    repetition INT DEFAULT 0,                     -- Consecutive successful reviews
    ease_factor NUMERIC(4, 2) DEFAULT 2.50,       -- SM-2 Easiness Factor (min 1.30)
    next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reviewed_date TIMESTAMP WITH TIME ZONE,
    state TEXT DEFAULT 'new',                     -- 'new' | 'learning' | 'review' | 'mastered'
    correct_count INT DEFAULT 0,
    incorrect_count INT DEFAULT 0,
    history JSONB DEFAULT '[]'::jsonb,            -- Review audit logs [{ date, rating, interval, responseType }]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist on upgraded deployments
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS explanation TEXT DEFAULT '';
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS correct_count INT DEFAULT 0;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS incorrect_count INT DEFAULT 0;

-- 3. Create Per-User Flashcard Study Progress Table
-- Isolates each student's SM-2 schedule, Know It / Still Learning responses, and review counts
-- without overwriting shared/starter card questions or answers.
CREATE TABLE IF NOT EXISTS public.flashcard_study_progress (
    id TEXT PRIMARY KEY,                          -- Deterministic key: `${user_id}__${card_id}`
    user_id TEXT NOT NULL,
    deck_id TEXT NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    reviewed BOOLEAN DEFAULT true,
    last_response TEXT DEFAULT 'know_it',         -- 'know_it' | 'still_learning' | 'again' | 'hard' | 'good' | 'easy'
    state TEXT DEFAULT 'learning',                -- 'new' | 'learning' | 'review' | 'mastered'
    interval INT DEFAULT 0,
    repetition INT DEFAULT 0,
    ease_factor NUMERIC(4, 2) DEFAULT 2.50,
    correct_count INT DEFAULT 0,
    incorrect_count INT DEFAULT 0,
    last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    history JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, card_id)
);

-- 4. Helpful Query Indexes
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON public.flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due_date ON public.flashcards(next_review_date);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user ON public.flashcard_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_subject ON public.flashcard_decks(subject);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_deck ON public.flashcard_study_progress(user_id, deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_card ON public.flashcard_study_progress(user_id, card_id);

-- 5. Enable Row Level Security (RLS) & Grant Table Privileges for StudentOS Auth
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_study_progress ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.flashcard_decks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.flashcards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.flashcard_study_progress TO anon, authenticated, service_role;

-- 6. RLS Policies compatible with StudentOS Custom Auth & Supabase Auth
DROP POLICY IF EXISTS "Decks are viewable by owner or system" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can insert their own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Allow all operations on flashcard_decks" ON public.flashcard_decks;

CREATE POLICY "Allow all operations on flashcard_decks"
    ON public.flashcard_decks FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Cards are viewable by deck owner or system" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert cards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update cards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete cards" ON public.flashcards;
DROP POLICY IF EXISTS "Allow all operations on flashcards" ON public.flashcards;

CREATE POLICY "Allow all operations on flashcards"
    ON public.flashcards FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on flashcard_study_progress" ON public.flashcard_study_progress;
CREATE POLICY "Allow all operations on flashcard_study_progress"
    ON public.flashcard_study_progress FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 7. Realtime Synchronization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'flashcard_decks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcard_decks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'flashcards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcards;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'flashcard_study_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcard_study_progress;
  END IF;
END $$;
