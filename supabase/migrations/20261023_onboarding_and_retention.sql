-- ============================================================================
-- StudentOS — Guided Onboarding & Learning Retention Engine
-- Migration: 20261023_onboarding_and_retention.sql
-- ============================================================================

-- 1. Student Onboarding & Learning Preferences
CREATE TABLE IF NOT EXISTS public.student_onboarding_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    school_id TEXT NOT NULL DEFAULT 'dps-main',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
    tour_skipped BOOLEAN NOT NULL DEFAULT FALSE,
    target_subjects JSONB NOT NULL DEFAULT '["Mathematics", "Science", "English"]'::jsonb,
    explanation_style VARCHAR(64) NOT NULL DEFAULT 'step_by_step',
    auto_voice BOOLEAN NOT NULL DEFAULT TRUE,
    session_pace VARCHAR(32) NOT NULL DEFAULT 'short',
    revision_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    speaking_language VARCHAR(32) NOT NULL DEFAULT 'mixed',
    interface_language VARCHAR(16) NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_onboarding UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON public.student_onboarding_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_school ON public.student_onboarding_preferences(school_id);

-- 2. Student Daily Missions (Academic Goals & XP Deduplication)
CREATE TABLE IF NOT EXISTS public.student_daily_missions (
    id TEXT PRIMARY KEY, -- e.g. mission_recall_2026-10-23_userId
    user_id UUID NOT NULL,
    school_id TEXT NOT NULL DEFAULT 'dps-main',
    mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_count INT NOT NULL DEFAULT 1,
    current_count INT NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    reward_xp INT NOT NULL DEFAULT 30,
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date ON public.student_daily_missions(user_id, mission_date);

-- 3. Student Retention Streaks & Softened Streak Freezes
CREATE TABLE IF NOT EXISTS public.student_retention_streaks (
    user_id UUID PRIMARY KEY,
    school_id TEXT NOT NULL DEFAULT 'dps-main',
    current_streak INT NOT NULL DEFAULT 1,
    longest_streak INT NOT NULL DEFAULT 1,
    last_active_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_softened BOOLEAN NOT NULL DEFAULT FALSE,
    freezes_remaining INT NOT NULL DEFAULT 1,
    streak_days JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_streaks_school ON public.student_retention_streaks(school_id);

-- 4. Byte Voice & Character Operational Telemetry (Aggregated & Privacy-Safe)
CREATE TABLE IF NOT EXISTS public.byte_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id TEXT NOT NULL DEFAULT 'dps-main',
    voice_id VARCHAR(128) NOT NULL,
    latency_ms INT NOT NULL,
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    duration_ms INT,
    language_code VARCHAR(32) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_byte_telemetry_recorded ON public.byte_telemetry_logs(recorded_at);

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.student_onboarding_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_daily_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_retention_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.byte_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- Preferences Policies: Students manage their own preferences; faculty/admins can view
CREATE POLICY "Students manage their own onboarding preferences"
    ON public.student_onboarding_preferences
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Faculty can view student onboarding preferences"
    ON public.student_onboarding_preferences
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.uid = auth.uid()
            AND user_profiles.role IN ('teacher', 'coordinator', 'admin', 'super_admin')
        )
    );

-- Daily Missions Policies
CREATE POLICY "Students manage their daily missions"
    ON public.student_daily_missions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Retention Streaks Policies
CREATE POLICY "Students manage their retention streaks"
    ON public.student_retention_streaks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Telemetry Policies: Server service role and super admins
CREATE POLICY "Super Admins view Byte telemetry"
    ON public.byte_telemetry_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.uid = auth.uid()
            AND user_profiles.role = 'super_admin'
        )
    );

CREATE POLICY "Allow authenticated telemetry submission"
    ON public.byte_telemetry_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
