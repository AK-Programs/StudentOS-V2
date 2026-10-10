-- ========================================================
-- StudentOS Workspace Security & Lock Table Schema
-- ========================================================

CREATE TABLE IF NOT EXISTS public.workspace_security (
    id TEXT PRIMARY KEY DEFAULT 'global_workspace',
    is_locked BOOLEAN DEFAULT false,
    pin_hash TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.workspace_security ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.workspace_security TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow all operations on workspace_security" ON public.workspace_security;
CREATE POLICY "Allow all operations on workspace_security"
    ON public.workspace_security FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

INSERT INTO public.workspace_security (id, is_locked)
VALUES ('global_workspace', false)
ON CONFLICT (id) DO NOTHING;
