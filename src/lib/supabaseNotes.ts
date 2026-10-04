import { supabase } from './supabase';
import { VaultNote } from '../types';

export async function getVaultNotes(userId: string): Promise<VaultNote[]> {
  try {
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId);
    if (error) {
      if (error.code === '42P01') {
         return [];
      }
      throw error;
    }
    if (data) {
       return data
         .filter(n => n.title !== '__SYSTEM_NOTIFICATION__' && !n.id.startsWith('notif_') && !n.id.startsWith('chat_'))
         .map(n => ({
           id: n.id,
           title: n.title,
           content: n.content,
           createdAt: n.created_at || new Date().toLocaleDateString(),
           subject: n.subject || '',
           icon: n.icon || '📝',
           coverBg: n.cover_bg || 'bg-gradient-to-r from-violet-600 to-indigo-900',
           userId: n.user_id
         }));
    }
  } catch (err) {
    console.error("Failed to get notes from supabase", err);
  }
  return [];
}

export async function saveVaultNoteToSupabase(note: VaultNote): Promise<void> {
  
  try {
    const { error } = await supabase.from('notes').upsert({
       id: note.id,
       title: note.title,
       content: note.content,
       subject: note.subject,
       icon: note.icon,
       cover_bg: note.coverBg,
       user_id: note.userId,
       created_at: note.createdAt
    });
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error("Failed to save note to supabase", err);
  }
}

export async function deleteVaultNoteFromSupabase(noteId: string, userId: string): Promise<void> {
  
  try {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {}
}






