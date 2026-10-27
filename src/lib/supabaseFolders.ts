import { supabase } from './supabase';

export interface Folder {
  id: string;
  name: string;
  type: 'notes' | 'materials';
  user_id: string;
  created_at?: string;
}

export async function getFolders(userId: string, type: 'notes' | 'materials'): Promise<Folder[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return [];
      console.warn('[FOLDERS] Supabase getFolders notice:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[FOLDERS] Failed to fetch folders:', err);
    return [];
  }
}

export async function createFolder(name: string, type: 'notes' | 'materials', userId: string): Promise<Folder> {
  if (!userId) {
    throw new Error('User ID is required to create a folder.');
  }

  const newFolder = {
    name: name.trim(),
    type,
    user_id: userId,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('folders')
      .insert(newFolder)
      .select()
      .single();

    if (error) {
      console.error('[FOLDERS] Supabase insert error:', error.message || error);
      throw new Error(error.message || 'Failed to create folder in database');
    }

    if (!data) {
      throw new Error('Folder created but no data returned from database');
    }

    return data as Folder;
  } catch (err: any) {
    console.error('[FOLDERS] Failed to create folder:', err);
    throw err;
  }
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('folders')
      .update({ name: newName.trim() })
      .eq('id', folderId);
    if (error && error.code !== '42P01') {
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.error('[FOLDERS] Failed to rename folder:', err);
    throw err;
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    await supabase.from('notes').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('materials').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('lecture_notes').update({ folder_id: null }).eq('folder_id', folderId);

    const { error } = await supabase.from('folders').delete().eq('id', folderId);
    if (error && error.code !== '42P01') {
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.error('[FOLDERS] Failed to delete folder:', err);
    throw err;
  }
}
