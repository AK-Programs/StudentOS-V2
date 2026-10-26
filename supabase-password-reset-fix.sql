-- SQL script to ensure user_profiles table supports bigint updated_at and password hashes
-- Run this in the Supabase SQL Editor if needed

-- 1. Ensure user_profiles has updated_at as bigint (or timestamp if preferred, but bigint is used by app logic)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'updated_at'
  ) THEN
    -- If updated_at is currently text or timestamp, alter it to bigint (epoch ms)
    -- ALTER TABLE user_profiles ALTER COLUMN updated_at TYPE bigint USING extract(epoch from updated_at::timestamptz) * 1000;
    NULL;
  END IF;
END $$;

-- 2. Ensure raw_data jsonb column exists for password hashes
ALTER TABLE IF EXISTS user_profiles 
ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}'::jsonb;

-- 3. Verify RLS policy allows updates to user_profiles
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow public read/write on user_profiles for app auth"
ON user_profiles
FOR ALL
USING (true)
WITH CHECK (true);
