import { supabase } from './supabase';

export interface Folder {
  id: string;
  name: string;
  type: 'notes' | 'materials';
  user_id: string;
  created_at?: string;
}

export async function getFolders(userId: string, type: 'notes' | 'materials'): Promise<Folder[]> {
  try {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('[FOLDERS] Failed to fetch folders:', err);
    return [];
  }
}

export async function createFolder(name: string, type: 'notes' | 'materials', userId: string): Promise<Folder | null> {
  const folder: Folder = {
    id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    type,
    user_id: userId,
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('folders').insert(folder);
    if (error && error.code !== '42P01') throw error;
    return folder;
  } catch (err) {
    console.error('[FOLDERS] Failed to create folder:', err);
    return null;
  }
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('folders')
      .update({ name: newName })
      .eq('id', folderId);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error('[FOLDERS] Failed to rename folder:', err);
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    // Note: Items inside the folder should probably be moved to "Uncategorized" (null folder_id)
    // or deleted. The requirement says "A user can create, rename, and delete a folder."
    // It doesn't specify what happens to contents. Usually moving to root is safer.
    await supabase.from('notes').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('materials').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('lecture_notes').update({ folder_id: null }).eq('folder_id', folderId);

    const { error } = await supabase.from('folders').delete().eq('id', folderId);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error('[FOLDERS] Failed to delete folder:', err);
  }
}
