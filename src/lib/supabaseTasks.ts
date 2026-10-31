import { supabase } from './supabase';
import { Task } from '../types';

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
      throw error;
    }

    return (data || []).map(t => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      category: t.category,
      dueDate: t.due_date,
      subject: t.subject,
      userId: t.user_id,
      createdAt: t.created_at,
      sort_order: t.sort_order
    })) as Task[];
  } catch (err) {
    console.error('[TASKS] Fetch error:', err);
    return [];
  }
}

export async function savePersonalTask(task: Task, userId: string): Promise<void> {
  try {
    const payload = {
      id: task.id.includes('-') ? task.id : undefined, // Only use UUIDs if they look like UUIDs
      user_id: userId,
      title: task.title,
      completed: task.completed,
      category: task.category,
      subject: task.subject,
      due_date: task.dueDate,
      sort_order: (task as any).sort_order || 0
    };

    const { error } = await supabase.from('personal_tasks').upsert(payload);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error('[TASKS] Save error:', err);
  }
}

export async function updateTaskOrder(tasks: Task[], userId: string): Promise<void> {
  try {
    const updates = tasks.map((t, idx) => ({
      id: t.id,
      user_id: userId,
      sort_order: idx
    }));

    const { error } = await supabase.from('personal_tasks').upsert(updates);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error('[TASKS] Order update error:', err);
  }
}

export async function deletePersonalTask(taskId: string): Promise<void> {
  try {
    const { error } = await supabase.from('personal_tasks').delete().eq('id', taskId);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error('[TASKS] Delete error:', err);
  }
}
