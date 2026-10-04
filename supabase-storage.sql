-- Supabase Storage Bucket Migration Script
-- Run this in your Supabase SQL Editor to enable file uploads for Material Hub and Assignment Centre

-- 1. Create the StudentOS bucket if it doesn't exist
insert into storage.buckets (id, name, public) 
values ('StudentOS', 'StudentOS', true)
on conflict (id) do update set public = true;

-- 2. Allow public access to read files from the StudentOS bucket
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" 
on storage.objects for select 
using ( bucket_id = 'StudentOS' );

-- 3. Allow public access to upload files to the StudentOS bucket
drop policy if exists "Public Upload" on storage.objects;
create policy "Public Upload" 
on storage.objects for insert 
with check ( bucket_id = 'StudentOS' );

-- 4. Allow public access to update files in the StudentOS bucket
drop policy if exists "Public Update" on storage.objects;
create policy "Public Update" 
on storage.objects for update 
using ( bucket_id = 'StudentOS' );

-- 5. Allow public access to delete files in the StudentOS bucket
drop policy if exists "Public Delete" on storage.objects;
create policy "Public Delete" 
on storage.objects for delete 
using ( bucket_id = 'StudentOS' );
