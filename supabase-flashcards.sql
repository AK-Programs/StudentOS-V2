-- ========================================================
-- StudentOS: Flashcards & Spaced Repetition (SM-2) Schema
-- ========================================================

-- 1. Create Flashcard Decks Table
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
    id TEXT PRIMARY KEY,
    user_id TEXT,                                 -- User UID or 'system' for default starter decks
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
    back TEXT NOT NULL,                           -- Answer / Explanation
    hint TEXT,                                    -- Optional retrieval hint
    tags JSONB DEFAULT '[]'::jsonb,
    interval INT DEFAULT 0,                       -- Interval in days
    repetition INT DEFAULT 0,                     -- Consecutive successful reviews
    ease_factor NUMERIC(4, 2) DEFAULT 2.50,       -- SM-2 Easiness Factor (min 1.30)
    next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reviewed_date TIMESTAMP WITH TIME ZONE,
    state TEXT DEFAULT 'new',                     -- 'new' | 'learning' | 'review' | 'mastered'
    history JSONB DEFAULT '[]'::jsonb,            -- Review audit logs [{ date, rating, interval }]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Helpful Query Indexes
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON public.flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due_date ON public.flashcards(next_review_date);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user ON public.flashcard_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_subject ON public.flashcard_decks(subject);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Allow users to read starter/system decks and their own decks
DROP POLICY IF EXISTS "Decks are viewable by owner or system" ON public.flashcard_decks;
CREATE POLICY "Decks are viewable by owner or system"
    ON public.flashcard_decks FOR SELECT
    USING (user_id = 'system' OR auth.uid()::text = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert their own decks" ON public.flashcard_decks;
CREATE POLICY "Users can insert their own decks"
    ON public.flashcard_decks FOR INSERT
    WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL OR user_id = 'system');

DROP POLICY IF EXISTS "Users can update their own decks" ON public.flashcard_decks;
CREATE POLICY "Users can update their own decks"
    ON public.flashcard_decks FOR UPDATE
    USING (auth.uid()::text = user_id OR user_id IS NULL OR user_id = 'system');

DROP POLICY IF EXISTS "Users can delete their own decks" ON public.flashcard_decks;
CREATE POLICY "Users can delete their own decks"
    ON public.flashcard_decks FOR DELETE
    USING (auth.uid()::text = user_id OR user_id IS NULL);

-- 6. RLS Policies for Flashcards
DROP POLICY IF EXISTS "Cards are viewable by deck owner or system" ON public.flashcards;
CREATE POLICY "Cards are viewable by deck owner or system"
    ON public.flashcards FOR SELECT
    USING (user_id = 'system' OR auth.uid()::text = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert cards" ON public.flashcards;
CREATE POLICY "Users can insert cards"
    ON public.flashcards FOR INSERT
    WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL OR user_id = 'system');

DROP POLICY IF EXISTS "Users can update cards" ON public.flashcards;
CREATE POLICY "Users can update cards"
    ON public.flashcards FOR UPDATE
    USING (auth.uid()::text = user_id OR user_id IS NULL OR user_id = 'system');

DROP POLICY IF EXISTS "Users can delete cards" ON public.flashcards;
CREATE POLICY "Users can delete cards"
    ON public.flashcards FOR DELETE
    USING (auth.uid()::text = user_id OR user_id IS NULL);

-- 7. Realtime Synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcard_decks, public.flashcards;
