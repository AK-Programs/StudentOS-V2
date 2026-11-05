import React, { useState, useEffect } from 'react';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Check, 
  Calendar, 
  Tag, 
  Flag, 
  Clock, 
  LayoutGrid, 
  List, 
  Filter, 
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { Task, UserProfile } from '../types';
import { 
  getPersonalTasks, 
  savePersonalTask, 
  deletePersonalTask, 
  updateTaskOrder 
} from '../lib/supabaseTasks';
import { soundService } from '../lib/soundService';
import { awardStudentXP } from '../lib/gamification';

interface StudyHubTaskManagerProps {
  currentUser: UserProfile;
  showNotification: (msg: string) => void;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onNavigateTab: (tab: string, subTab?: string) => void;
}

type ViewMode = 'list' | 'kanban';
type Priority = 'low' | 'medium' | 'high';

export const StudyHubTaskManager: React.FC<StudyHubTaskManagerProps> = ({
  currentUser,
  showNotification,
  tasks,
  onTasksChange,
  onNavigateTab
}) => {
  const userId = currentUser.uid || currentUser.email || 'guest';
  
  const [loading, setLoading] = useState(false); // No longer needs to fetch internally on mount
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('General');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSubject, setFilterSubject] = useState('All');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    // Initial fetch handled by parent if needed, but we can still refresh here if desired
    // Or just rely on parent state
  }, [userId]);

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      completed: false,
      subject: newTaskSubject,
      category: newTaskPriority, // Using category for priority for now
      dueDate: new Date().toISOString().split('T')[0],
      userId: userId,
      createdAt: new Date().toISOString(),
      sort_order: tasks.length
    };

    try {
      await savePersonalTask(newTask, userId);
      onTasksChange([...tasks, newTask]);
      setNewTaskTitle('');
      setIsAddingTask(false);
      soundService.playButtonClick();
      showNotification('Task added successfully!');
    } catch (error) {
      showNotification('Failed to add task.');
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, completed: !task.completed };
    
    try {
      await savePersonalTask(updatedTask, userId);
      onTasksChange(tasks.map(t => t.id === taskId ? updatedTask : t));
      
      if (updatedTask.completed) {
        soundService.playLevelUp();
        awardStudentXP(currentUser, 'complete_homework', {
          customXpAmount: 20,
          customLabel: `Completed Task: ${task.title}`
        });
        showNotification('Goal achieved! +20 XP');
      } else {
        soundService.playButtonClick();
      }
    } catch (error) {
      showNotification('Failed to update task.');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deletePersonalTask(taskId);
      onTasksChange(tasks.filter(t => t.id !== taskId));
      soundService.playButtonClick();
      showNotification('Task removed.');
    } catch (error) {
      showNotification('Failed to delete task.');
    }
  };

  const handleReorder = async (newOrder: Task[]) => {
    onTasksChange(newOrder);
    try {
      await updateTaskOrder(newOrder, userId);
    } catch (error) {
      console.error('Failed to update task order:', error);
    }
  };

  const subjects = ['General', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Computer Science'];
  const priorities: Priority[] = ['low', 'medium', 'high'];

  const filteredTasks = tasks.filter(t => {
    if (filterSubject === 'All') return true;
    return t.subject === filterSubject;
  });

  const kanbanColumns = [
    { id: 'todo', title: 'To Do', icon: <Clock className="w-4 h-4" /> },
    { id: 'completed', title: 'Completed', icon: <CheckCircle2 className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-display text-white tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-indigo-400" />
            Task Manager
          </h2>
          <p className="text-xs text-slate-400">Organize your study goals and syllabus objectives.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold ${showFilters ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/20'}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <button
            onClick={() => setIsAddingTask(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Quick Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-wrap gap-2">
              <span className="text-[10px] font-black uppercase text-slate-500 w-full mb-1">Filter by Subject</span>
              <button
                onClick={() => setFilterSubject('All')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterSubject === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-white/5 text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              {subjects.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSubject(s)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterSubject === s ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-white/5 text-slate-400 hover:text-white'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Task Modal-ish Inline */}
      <AnimatePresence>
        {isAddingTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="smart-glass p-5 rounded-2xl border border-indigo-500/30 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white uppercase tracking-wider">New Focus Objective</h4>
              <button onClick={() => setIsAddingTask(false)} className="text-slate-500 hover:text-white">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="What do you want to achieve?"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              />
              
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Subject</label>
                  <select
                    value={newTaskSubject}
                    onChange={e => setNewTaskSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Priority</label>
                  <div className="flex items-center p-1 bg-slate-950 border border-white/10 rounded-xl">
                    {priorities.map(p => (
                      <button
                        key={p}
                        onClick={() => setNewTaskPriority(p)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${newTaskPriority === p ? (p === 'high' ? 'bg-rose-600 text-white' : p === 'medium' ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white') : 'text-slate-500 hover:text-white'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddingTask(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase shadow-md active:scale-95 transition-all"
              >
                Create Task
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Views */}
      {loading ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-mono">Syncing with Supabase...</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          <Reorder.Group axis="y" values={filteredTasks} onReorder={handleReorder} className="space-y-3">
            {filteredTasks.map(task => (
              <Reorder.Item
                key={task.id}
                value={task}
                className="group relative"
              >
                <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${task.completed ? 'bg-slate-950/40 border-white/5' : 'bg-slate-900 border-white/10 hover:border-indigo-500/30'}`}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/20 hover:border-indigo-500/50 hover:bg-indigo-500/10'}`}
                    >
                      {task.completed && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">{task.subject}</span>
                        {task.category === 'high' && (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertCircle className="w-2.5 h-2.5" /> High Priority
                          </span>
                        )}
                        {task.category === 'medium' && (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Flag className="w-2.5 h-2.5" /> Medium
                          </span>
                        )}
                      </div>
                      <h4 className={`text-sm font-bold truncate transition-all ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                        {task.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          soundService.playButtonClick();
                          onNavigateTab('study_hub', 'planner');
                        }}
                        className="px-2 py-1 rounded-lg bg-indigo-600/10 text-indigo-400 text-[9px] font-bold border border-indigo-500/20 hover:bg-indigo-600/20 transition-all mb-1"
                        title="Schedule study session for this task"
                      >
                        Schedule
                      </button>
                      <span className="text-[10px] text-slate-500 font-mono uppercase">Due Today</span>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {filteredTasks.length === 0 && (
            <div className="py-20 text-center space-y-4 rounded-3xl border-2 border-dashed border-white/5 bg-slate-900/20">
              <div className="text-4xl">🎯</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">No tasks found</p>
                <p className="text-xs text-slate-500">Your focus list is clear! Start by adding a new objective.</p>
              </div>
              <button
                onClick={() => setIsAddingTask(true)}
                className="text-xs font-black text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
              >
                Create your first task
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {kanbanColumns.map(col => {
            const colTasks = filteredTasks.filter(t => col.id === 'completed' ? t.completed : !t.completed);
            return (
              <div key={col.id} className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    {col.icon}
                    <span className="text-xs font-black uppercase tracking-widest">{col.title}</span>
                  </div>
                  <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded-full text-slate-500">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[200px]">
                  {colTasks.map(task => (
                    <motion.div
                      layout
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border bg-slate-900 shadow-sm transition-all ${task.completed ? 'border-emerald-500/20 opacity-75' : 'border-white/10 hover:border-indigo-500/30'}`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">{task.subject}</span>
                          <button onClick={() => toggleTask(task.id)} className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/20 hover:border-indigo-500/50'}`}>
                            {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        </div>
                        <p className={`text-xs font-bold leading-relaxed ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <div className="flex items-center gap-1.5">
                            {task.category === 'high' && <span className="w-2 h-2 rounded-full bg-rose-500" title="High Priority" />}
                            {task.category === 'medium' && <span className="w-2 h-2 rounded-full bg-amber-500" title="Medium Priority" />}
                            {task.category === 'low' && <span className="w-2 h-2 rounded-full bg-indigo-500" title="Low Priority" />}
                            <span className="text-[9px] text-slate-500 font-mono">Today</span>
                          </div>
                          <button onClick={() => deleteTask(task.id)} className="text-slate-600 hover:text-rose-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-white/5 rounded-3xl flex items-center justify-center">
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">No tasks here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
