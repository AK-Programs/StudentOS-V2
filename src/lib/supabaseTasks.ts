import { supabase } from './supabase';
import { Task } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id?: string): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

export async function getPersonalTasks(userId: string): Promise<Task[]> {
  try {
    const { data, error } = await supabase
      .from('personal_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return [];
      }
      console.warn('[TASKS] Fetch query warning:', error.message);
      return [];
    }

    return (data || []).map(t => ({
      id: t.id,
      title: t.title || 'Untitled Task',
      description: t.description || '',
      completed: !!t.completed,
      status: t.status || (t.completed ? 'completed' : 'todo'),
      priority: t.priority || t.category || 'medium',
      category: t.category || 'general',
      subject: t.subject || 'General',
      dueDate: t.due_date || '',
      startDate: t.start_date || '',
      estimatedMinutes: Number(t.estimated_minutes) || 0,
      actualMinutes: Number(t.actual_minutes) || 0,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      tags: Array.isArray(t.tags) ? t.tags : [],
      linkedSessionId: t.linked_session_id || undefined,
      linkedDeckId: t.linked_deck_id || undefined,
      kanbanColumnId: t.kanban_column_id || (t.completed ? 'completed' : 'todo'),
      userId: t.user_id,
      createdAt: t.created_at || new Date().toISOString(),
      sort_order: Number(t.sort_order) || 0
    })) as Task[];
  } catch (err) {
    console.error('[TASKS] Fetch error:', err);
    return [];
  }
}

export async function savePersonalTask(task: Task, userId: string): Promise<Task> {
  try {
    // Only send valid UUIDs. If frontend passed 'task-1741234', send undefined to let Supabase gen UUID
    const cleanId = isValidUUID(task.id) ? task.id : undefined;

    const payload: any = {
      ...(cleanId ? { id: cleanId } : {}),
      user_id: userId,
      title: task.title,
      description: task.description || '',
      completed: task.completed ?? false,
      status: task.status || (task.completed ? 'completed' : 'todo'),
      priority: task.priority || task.category || 'medium',
      category: task.category || task.priority || 'general',
      subject: task.subject || 'General',
      due_date: task.dueDate || null,
      start_date: task.startDate || null,
      estimated_minutes: task.estimatedMinutes || 0,
      actual_minutes: task.actualMinutes || 0,
      subtasks: task.subtasks || [],
      tags: task.tags || [],
      linked_session_id: task.linkedSessionId || null,
      linked_deck_id: task.linkedDeckId || null,
      kanban_column_id: task.kanbanColumnId || (task.completed ? 'completed' : 'todo'),
      sort_order: task.sort_order || 0
    };

    const { data, error } = await supabase
      .from('personal_tasks')
      .upsert(payload)
      .select('*')
      .single();

    if (error) {
      if (error.code === '42P01') {
        console.warn('[TASKS] Table personal_tasks missing, returning local task');
        return task;
      }
      // If error is due to missing columns, retry with basic payload
      if (error.code === '42703') {
        console.warn('[TASKS] Column mismatch, retrying basic upsert');
        const basicPayload = {
          ...(cleanId ? { id: cleanId } : {}),
          user_id: userId,
          title: task.title,
          completed: task.completed ?? false,
          category: task.category || task.priority || 'medium',
          subject: task.subject || 'General',
          due_date: task.dueDate || null,
          sort_order: task.sort_order || 0
        };
        const { data: bData, error: bErr } = await supabase
          .from('personal_tasks')
          .upsert(basicPayload)
          .select('*')
          .single();
        if (bErr) throw bErr;
        return {
          ...task,
          id: bData?.id || task.id
        };
      }
      throw error;
    }

    return {
      ...task,
      id: data?.id || task.id,
      createdAt: data?.created_at || task.createdAt
    };
  } catch (err) {
    console.error('[TASKS] Save error:', err);
    throw err;
  }
}

export async function updateTaskOrder(tasks: Task[], userId: string): Promise<void> {
  try {
    const validUpdates = tasks
      .filter(t => isValidUUID(t.id))
      .map((t, idx) => ({
        id: t.id,
        user_id: userId,
        sort_order: idx
      }));

    if (validUpdates.length === 0) return;

    const { error } = await supabase.from('personal_tasks').upsert(validUpdates);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error('[TASKS] Order update error:', err);
  }
}

export async function deletePersonalTask(taskId: string): Promise<void> {
  try {
    if (!isValidUUID(taskId)) {
      console.warn('[TASKS] Skipping deletion for non-UUID task ID:', taskId);
      return;
    }
    const { error } = await supabase.from('personal_tasks').delete().eq('id', taskId);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error('[TASKS] Delete error:', err);
  }
}

export function subscribeToPersonalTasks(userId: string, onUpdate: () => void) {
  try {
    const channel = supabase
      .channel(`personal_tasks_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personal_tasks',
          filter: `user_id=eq.${userId}`
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.error('[TASKS] Realtime subscription error:', e);
    return () => {};
  }
}
