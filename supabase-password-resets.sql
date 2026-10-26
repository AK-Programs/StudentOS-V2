-- ========================================================
-- Password Resets Table Schema & RLS Policy (Anon Key Access)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.password_resets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at BIGINT NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Grant table access to anon and authenticated roles
GRANT ALL ON TABLE public.password_resets TO anon, authenticated, service_role;

-- Allow INSERT for anon key
DROP POLICY IF EXISTS "Allow insert for password_resets" ON public.password_resets;
CREATE POLICY "Allow insert for password_resets"
    ON public.password_resets FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);

-- Allow SELECT for anon key
DROP POLICY IF EXISTS "Allow select for password_resets" ON public.password_resets;
CREATE POLICY "Allow select for password_resets"
    ON public.password_resets FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

-- Allow UPDATE for anon key
DROP POLICY IF EXISTS "Allow update for password_resets" ON public.password_resets;
CREATE POLICY "Allow update for password_resets"
    ON public.password_resets FOR UPDATE
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Allow DELETE for anon key
DROP POLICY IF EXISTS "Allow delete for password_resets" ON public.password_resets;
CREATE POLICY "Allow delete for password_resets"
    ON public.password_resets FOR DELETE
    TO anon, authenticated, service_role
    USING (true);
