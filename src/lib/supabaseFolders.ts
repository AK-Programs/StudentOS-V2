import { supabase } from './supabase';

export interface Folder {
  id: string;
  name: string;
  type: 'notes' | 'materials';
  user_id: string;
  created_at?: string;
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
}

function toValidUUID(str: string): string {
  if (!str) return '00000000-0000-0000-0000-000000000000';
  if (isValidUUID(str)) return str;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const h1 = Math.abs(hash).toString(16).padStart(8, '0');
  const h2 = Math.abs(hash * 31 % 0xFFFFFFFF).toString(16).padStart(8, '0');
  const h3 = Math.abs(hash * 127 % 0xFFFFFFFF).toString(16).padStart(8, '0');
  const h4 = Math.abs(hash * 8191 % 0xFFFFFFFF).toString(16).padStart(8, '0');
  return `${h1}-${h2.slice(0, 4)}-4${h2.slice(4, 7)}-a${h3.slice(0, 3)}-${h3.slice(3)}${h4.slice(0, 7)}`.toLowerCase();
}

export async function getFolders(userId: string, type: 'notes' | 'materials'): Promise<Folder[]> {
  if (!userId) return [];
  
  const idsToTry = [userId];
  if (!isValidUUID(userId)) {
    idsToTry.push(toValidUUID(userId));
  }

  try {
    for (const uid of idsToTry) {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', uid)
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return []; // Table missing
        if (error.code === '22P02' || error.message?.includes('invalid input syntax for type uuid')) {
          continue; // Retry with fallback UUID if column is UUID type
        }
        console.warn('[FOLDERS] Supabase getFolders notice:', error.message);
        return [];
      }
      if (data && data.length > 0) return data as Folder[];
    }
  } catch (err) {
    console.error('[FOLDERS] Failed to fetch folders:', err);
  }
  return [];
}

export async function createFolder(name: string, type: 'notes' | 'materials', userId: string): Promise<Folder> {
  if (!userId) {
    throw new Error('User ID is required to create a folder.');
  }

  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Folder name cannot be empty.');
  }

  const payload: any = {
    name: cleanName,
    type,
    user_id: userId,
    created_at: new Date().toISOString()
  };

  try {
    // Attempt 1: Insert with raw userId (works if folders.user_id is text)
    const { data, error } = await supabase
      .from('folders')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return data as Folder;
    }

    if (error && (error.code === '22P02' || error.message?.includes('invalid input syntax for type uuid'))) {
      // Attempt 2: Retry with valid UUID formatted string if folders.user_id is UUID column in Supabase
      console.warn('[FOLDERS] user_id column is UUID type in Supabase. Converting non-UUID userId to valid UUID format.');
      const uuidPayload = { ...payload, user_id: toValidUUID(userId) };
      const { data: retryData, error: retryError } = await supabase
        .from('folders')
        .insert(uuidPayload)
        .select()
        .single();

      if (retryError) {
        console.error('[FOLDERS] Supabase insert retry error:', retryError.message);
        throw new Error(retryError.message || 'Failed to create folder in database');
      }
      if (retryData) {
        return retryData as Folder;
      }
    }

    if (error) {
      console.error('[FOLDERS] Supabase insert error:', error.message || error);
      throw new Error(error.message || 'Failed to create folder in database');
    }

    throw new Error('Folder created but no data returned from database');
  } catch (err: any) {
    console.error('[FOLDERS] Failed to create folder:', err);
    throw err;
  }
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  const cleanName = newName.trim();
  if (!cleanName) return;

  try {
    const { error } = await supabase
      .from('folders')
      .update({ name: cleanName })
      .eq('id', folderId);

    if (error && error.code !== '42P01') {
      console.error('[FOLDERS] Failed to rename folder:', error.message);
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.error('[FOLDERS] Rename error:', err);
    throw err;
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    // Remove folder reference from items first
    await supabase.from('notes').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('materials').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('school_resources').update({ folder_id: null }).eq('folder_id', folderId);
    await supabase.from('assignments').update({ folder_id: null }).eq('folder_id', folderId);

    const { error } = await supabase.from('folders').delete().eq('id', folderId);
    if (error && error.code !== '42P01') {
      console.error('[FOLDERS] Delete folder error:', error.message);
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.error('[FOLDERS] Delete error:', err);
    throw err;
  }
}
