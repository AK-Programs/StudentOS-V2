import { supabase } from './supabase';

export interface Folder {
  id: string;
  name: string;
  type: 'notes' | 'materials';
  user_id: string;
  created_at?: string;
}

/**
 * Retrieves the genuine active Supabase user ID if an auth session exists,
 * or falls back to the provided application user ID.
 */
async function resolveAuthUserId(fallbackUserId: string): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch (_) {}
  return fallbackUserId || 'guest';
}

export async function getFolders(userId: string, type: 'notes' | 'materials'): Promise<Folder[]> {
  if (!userId) return [];
  
  try {
    const authId = await resolveAuthUserId(userId);
    const candidateUids = Array.from(new Set([authId, userId].filter(Boolean)));

    // Attempt 1: Query matching candidate user IDs
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .in('user_id', candidateUids)
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data as Folder[];
    }

    if (error) {
      if (error.code === '42P01') return []; // Table missing in Supabase
      console.warn('[FOLDERS] getFolders error:', error.message);
    }
  } catch (err) {
    console.error('[FOLDERS] Failed to fetch folders:', err);
  }
  return [];
}

export async function createFolder(name: string, type: 'notes' | 'materials', userId: string): Promise<Folder> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Folder name cannot be empty.');
  }

  // Use active Supabase Auth user ID if signed in so it satisfies RLS auth.uid() = user_id
  const targetUserId = await resolveAuthUserId(userId);

  const payload = {
    name: cleanName,
    type,
    user_id: targetUserId,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('folders')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[FOLDERS] Supabase insert error:', error);
    throw new Error(error.message || 'Failed to save folder in Supabase');
  }

  if (!data) {
    throw new Error('Folder created but no row was returned from Supabase');
  }

  return data as Folder;
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  const cleanName = newName.trim();
  if (!cleanName) throw new Error('Folder name cannot be empty.');

  const { error } = await supabase
    .from('folders')
    .update({ name: cleanName })
    .eq('id', folderId);

  if (error) {
    console.error('[FOLDERS] Rename error:', error);
    throw new Error(error.message || 'Failed to rename folder');
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    // Unassign folder_id from all child notes and resources
    await Promise.allSettled([
      supabase.from('notes').update({ folder_id: null }).eq('folder_id', folderId),
      supabase.from('materials').update({ folder_id: null }).eq('folder_id', folderId),
      supabase.from('school_resources').update({ folder_id: null }).eq('folder_id', folderId),
      supabase.from('assignments').update({ folder_id: null }).eq('folder_id', folderId)
    ]);

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (error && error.code !== '42P01') {
      console.error('[FOLDERS] Delete error:', error);
      throw new Error(error.message || 'Failed to delete folder');
    }
  } catch (err: any) {
    console.error('[FOLDERS] Delete exception:', err);
    throw err;
  }
}
