-- StudentOS Supabase Migration Script for Blogs
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.blogs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author TEXT,
  author_id TEXT NOT NULL,
  author_name TEXT,
  author_role TEXT,
  author_image TEXT,
  cover_image TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'General',
  tags JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  published_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_blogs_author_id ON public.blogs(author_id);
CREATE INDEX IF NOT EXISTS idx_blogs_category ON public.blogs(category);
CREATE INDEX IF NOT EXISTS idx_blogs_is_published ON public.blogs(is_published);

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access for blogs" ON public.blogs;
CREATE POLICY "Allow public access for blogs" ON public.blogs FOR ALL USING (true) WITH CHECK (true);
