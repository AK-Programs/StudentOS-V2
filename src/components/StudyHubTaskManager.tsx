import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Check, 
  Calendar, 
  Tag as TagIcon, 
  Flag, 
  Clock, 
  LayoutGrid, 
  List, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen,
  Search,
  ChevronRight,
  Edit3,
  Layers,
  Sparkles,
  TrendingUp,
  BarChart2,
  ArrowUpRight,
  X,
  Link2,
  Zap,
  CheckSquare,
  PlusCircle,
  CalendarRange,
  RotateCcw,
  SlidersHorizontal,
  FolderKanban
} from 'lucide-react';
import { Task, SubTask, UserProfile } from '../types';
import { 
  getPersonalTasks, 
  savePersonalTask, 
  deletePersonalTask, 
  updateTaskOrder,
  subscribeToPersonalTasks
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

type MainTab = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed' | 'kanban' | 'calendar' | 'subject' | 'priority';
type ViewMode = 'list' | 'kanban';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';

export const StudyHubTaskManager: React.FC<StudyHubTaskManagerProps> = ({
  currentUser,
  showNotification,
  tasks,
  onTasksChange,
  onNavigateTab
}) => {
  const userId = currentUser.uid || currentUser.email || 'guest';
  
  const [activeTab, setActiveTab] = useState<MainTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'sort_order'>('sort_order');
  
  // Quick Add State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickSubject, setQuickSubject] = useState('General');
  const [quickPriority, setQuickPriority] = useState<Priority>('medium');
  const [quickDueDate, setQuickDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Detail Drawer State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  // Realtime Sync Subscription
  useEffect(() => {
    if (!userId || userId === 'guest') return;
    
    // Initial fetch to make sure tasks are fresh from Supabase
    getPersonalTasks(userId).then(fetched => {
      if (fetched && fetched.length > 0) {
        onTasksChange(fetched);
      }
    });

    const unsubscribe = subscribeToPersonalTasks(userId, async () => {
      const fresh = await getPersonalTasks(userId);
      onTasksChange(fresh);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const subjects = ['General', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Computer Science'];
  const priorities: Priority[] = ['low', 'medium', 'high', 'urgent'];

  // Handle Quick Add Task
  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim()) return;

    const tempId = `task-${Date.now()}`;
    const newTask: Task = {
      id: tempId,
      title: quickTitle.trim(),
      description: '',
      completed: false,
      status: 'todo',
      priority: quickPriority,
      category: quickPriority,
      subject: quickSubject,
      dueDate: quickDueDate || new Date().toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      estimatedMinutes: 30,
      actualMinutes: 0,
      subtasks: [],
      tags: [],
      kanbanColumnId: 'todo',
      userId: userId,
      createdAt: new Date().toISOString(),
      sort_order: tasks.length
    };

    // Optimistic UI update
    const updatedTasks = [...tasks, newTask];
    onTasksChange(updatedTasks);
    setQuickTitle('');
    setIsQuickAdding(false);
    soundService.playButtonClick();

    try {
      const saved = await savePersonalTask(newTask, userId);
      // Replace temporary ID task with real Supabase UUID task
      onTasksChange(updatedTasks.map(t => t.id === tempId ? saved : t));
      showNotification('Task saved and synced!');
    } catch (error) {
      console.error('Failed to sync task to Supabase:', error);
      showNotification('Task saved locally (offline).');
    }
  };

  // Toggle Task Completion
  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const nextCompleted = !task.completed;
    const nextStatus: TaskStatus = nextCompleted ? 'completed' : 'todo';
    const nextKanbanCol = nextCompleted ? 'completed' : 'todo';
    
    const updatedTask: Task = { 
      ...task, 
      completed: nextCompleted,
      status: nextStatus,
      kanbanColumnId: nextKanbanCol
    };
    
    // Optimistic update
    onTasksChange(tasks.map(t => t.id === taskId ? updatedTask : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask(updatedTask);
    }

    try {
      const saved = await savePersonalTask(updatedTask, userId);
      onTasksChange(tasks.map(t => t.id === taskId ? saved : t));
      
      if (nextCompleted) {
        soundService.playLevelUp();
        awardStudentXP(currentUser, 'complete_homework', {
          customXpAmount: 25,
          customLabel: `Task: ${task.title}`
        });
        showNotification('Task completed! +25 XP');
      } else {
        soundService.playButtonClick();
      }
    } catch (error) {
      showNotification('Failed to update task.');
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    onTasksChange(tasks.filter(t => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
    soundService.playButtonClick();

    try {
      await deletePersonalTask(taskId);
      showNotification('Task deleted.');
    } catch (error) {
      showNotification('Failed to delete task from server.');
    }
  };

  // Reorder Tasks (List View)
  const handleReorder = async (newOrder: Task[]) => {
    onTasksChange(newOrder);
    try {
      await updateTaskOrder(newOrder, userId);
    } catch (error) {
      console.error('Failed to update task order:', error);
    }
  };

  // Move Task in Kanban Column
  const handleMoveKanban = async (task: Task, targetColumn: TaskStatus) => {
    const isCompleted = targetColumn === 'completed';
    const updatedTask: Task = {
      ...task,
      status: targetColumn,
      kanbanColumnId: targetColumn,
      completed: isCompleted
    };

    onTasksChange(tasks.map(t => t.id === task.id ? updatedTask : t));
    soundService.playButtonClick();

    try {
      await savePersonalTask(updatedTask, userId);
      if (isCompleted && !task.completed) {
        awardStudentXP(currentUser, 'complete_homework', {
          customXpAmount: 25,
          customLabel: `Kanban Done: ${task.title}`
        });
        showNotification('Moved to Completed! +25 XP');
      }
    } catch (err) {
      console.error('Failed to update Kanban column:', err);
    }
  };

  // Detail Drawer Updates
  const handleUpdateSelectedTask = async (updated: Task) => {
    setSelectedTask(updated);
    onTasksChange(tasks.map(t => t.id === updated.id ? updated : t));
    try {
      const saved = await savePersonalTask(updated, userId);
      onTasksChange(tasks.map(t => t.id === updated.id ? saved : t));
    } catch (err) {
      console.error('Save task details error:', err);
    }
  };

  const handleAddSubtask = () => {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    const newSub: SubTask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false
    };
    const updated: Task = {
      ...selectedTask,
      subtasks: [...(selectedTask.subtasks || []), newSub]
    };
    setNewSubtaskTitle('');
    handleUpdateSelectedTask(updated);
  };

  const handleToggleSubtask = (subId: string) => {
    if (!selectedTask) return;
    const updatedSubs = (selectedTask.subtasks || []).map(s => 
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    const updated: Task = { ...selectedTask, subtasks: updatedSubs };
    handleUpdateSelectedTask(updated);
  };

  const handleRemoveSubtask = (subId: string) => {
    if (!selectedTask) return;
    const updatedSubs = (selectedTask.subtasks || []).filter(s => s.id !== subId);
    const updated: Task = { ...selectedTask, subtasks: updatedSubs };
    handleUpdateSelectedTask(updated);
  };

  const handleAddTag = () => {
    if (!selectedTask || !newTagInput.trim()) return;
    const tag = newTagInput.trim().toLowerCase();
    if (selectedTask.tags?.includes(tag)) return;
    const updated: Task = {
      ...selectedTask,
      tags: [...(selectedTask.tags || []), tag]
    };
    setNewTagInput('');
    handleUpdateSelectedTask(updated);
  };

  const handleRemoveTag = (tag: string) => {
    if (!selectedTask) return;
    const updated: Task = {
      ...selectedTask,
      tags: (selectedTask.tags || []).filter(t => t !== tag)
    };
    handleUpdateSelectedTask(updated);
  };

  // Date Calculation Helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        const matchSubject = task.subject?.toLowerCase().includes(q);
        const matchTag = task.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchSubject && !matchTag) return false;
      }

      // Subject Filter
      if (selectedSubjectFilter !== 'All' && task.subject !== selectedSubjectFilter) {
        return false;
      }

      // Priority Filter
      if (selectedPriorityFilter !== 'All' && task.priority !== selectedPriorityFilter) {
        return false;
      }

      // Main Tab View Filtering
      if (activeTab === 'today') {
        return task.dueDate === todayStr;
      }
      if (activeTab === 'upcoming') {
        return task.dueDate && task.dueDate > todayStr && !task.completed;
      }
      if (activeTab === 'overdue') {
        return task.dueDate && task.dueDate < todayStr && !task.completed;
      }
      if (activeTab === 'completed') {
        return task.completed;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        const pOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (pOrder[b.priority || 'medium'] || 0) - (pOrder[a.priority || 'medium'] || 0);
      }
      if (sortBy === 'dueDate') {
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      }
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [tasks, searchQuery, selectedSubjectFilter, selectedPriorityFilter, activeTab, todayStr, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < todayStr && !t.completed).length;
    const todayCount = tasks.filter(t => t.dueDate === todayStr && !t.completed).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const totalEst = tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
    const totalAct = tasks.reduce((acc, t) => acc + (t.actualMinutes || 0), 0);
    return { total, completed, overdue, todayCount, completionRate, totalEst, totalAct };
  }, [tasks, todayStr]);

  const kanbanColumns: { id: TaskStatus; title: string; color: string; bg: string }[] = [
    { id: 'todo', title: 'To Do', color: 'text-indigo-400', bg: 'border-indigo-500/20 bg-indigo-500/5' },
    { id: 'in_progress', title: 'In Progress', color: 'text-amber-400', bg: 'border-amber-500/20 bg-amber-500/5' },
    { id: 'review', title: 'Review / Submissions', color: 'text-purple-400', bg: 'border-purple-500/20 bg-purple-500/5' },
    { id: 'completed', title: 'Completed', color: 'text-emerald-400', bg: 'border-emerald-500/20 bg-emerald-500/5' }
  ];

  return (
    <div className="space-y-6 animate-fadeIn max-w-7xl mx-auto pb-16 px-1 sm:px-4">
      {/* Top Banner & Workspace Header */}
      <div className="smart-glass p-6 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5" /> Study Productivity Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                Supabase Live Sync ON
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display flex items-center gap-3">
              Task Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Organize syllabus assignments, set study priorities, manage subtask checklists, and track time.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="p-2.5 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Tasks</p>
              <p className="text-lg font-black text-white font-mono">{stats.total}</p>
            </div>
            <div className="p-2.5 text-center border-l border-white/10">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Due Today</p>
              <p className="text-lg font-black text-amber-400 font-mono">{stats.todayCount}</p>
            </div>
            <div className="p-2.5 text-center border-l border-white/10">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Overdue</p>
              <p className="text-lg font-black text-rose-400 font-mono">{stats.overdue}</p>
            </div>
            <div className="p-2.5 text-center border-l border-white/10">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Done %</p>
              <p className="text-lg font-black text-emerald-400 font-mono">{stats.completionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Views & Controls Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
          {/* Main Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-1">
            <button
              onClick={() => { setActiveTab('all'); setViewMode('list'); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'all' && viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <List className="w-4 h-4" /> All Tasks
            </button>
            <button
              onClick={() => { setActiveTab('kanban'); setViewMode('kanban'); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban Board
            </button>
            <button
              onClick={() => { setActiveTab('today'); setViewMode('list'); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'today' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Clock className="w-4 h-4 text-amber-400" /> Today ({stats.todayCount})
            </button>
            <button
              onClick={() => { setActiveTab('upcoming'); setViewMode('list'); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'upcoming' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Calendar className="w-4 h-4 text-indigo-400" /> Upcoming
            </button>
            {stats.overdue > 0 && (
              <button
                onClick={() => { setActiveTab('overdue'); setViewMode('list'); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'overdue' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-rose-400 hover:bg-rose-500/10'}`}
              >
                <AlertCircle className="w-4 h-4" /> Overdue ({stats.overdue})
              </button>
            )}
            <button
              onClick={() => { setActiveTab('completed'); setViewMode('list'); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'completed' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completed ({stats.completed})
            </button>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsQuickAdding(!isQuickAdding)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 border border-white/5 rounded-2xl">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks, tags, or subjects..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Subject:</span>
            <select
              value={selectedSubjectFilter}
              onChange={e => setSelectedSubjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
            >
              <option value="All">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Priority:</span>
            <select
              value={selectedPriorityFilter}
              onChange={e => setSelectedPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
            >
              <option value="All">All Priorities</option>
              {priorities.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
            >
              <option value="sort_order">Custom Order</option>
              <option value="priority">Priority (High to Low)</option>
              <option value="dueDate">Due Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Add Task Floating Card */}
      <AnimatePresence>
        {isQuickAdding && (
          <motion.form
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            onSubmit={handleCreateTask}
            className="smart-glass p-5 rounded-2xl border border-indigo-500/40 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-400" /> Create New Focus Objective
              </h3>
              <button type="button" onClick={() => setIsQuickAdding(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="What is your study goal or task?"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</label>
                  <select
                    value={quickSubject}
                    onChange={e => setQuickSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none"
                  >
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priority Level</label>
                  <select
                    value={quickPriority}
                    onChange={e => setQuickPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none"
                  >
                    {priorities.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={quickDueDate}
                    onChange={e => setQuickDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQuickAdding(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase shadow-md active:scale-95 transition-all"
              >
                Save Task
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Main Task Display Section */}
      {viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kanbanColumns.map(col => {
            const colTasks = filteredTasks.filter(t => {
              if (col.id === 'completed') return t.completed;
              if (col.id === 'todo') return !t.completed && (t.status === 'todo' || !t.status);
              return !t.completed && t.status === col.id;
            });

            return (
              <div key={col.id} className={`p-4 rounded-3xl border ${col.bg} backdrop-blur-sm space-y-4 flex flex-col min-h-[450px]`}>
                <div className="flex items-center justify-between px-1 border-b border-white/5 pb-3">
                  <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${col.color}`}>
                    <Layers className="w-3.5 h-3.5" /> {col.title}
                  </h3>
                  <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-full text-slate-300 font-bold">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar">
                  {colTasks.map(task => (
                    <motion.div
                      layout
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-4 rounded-2xl border bg-slate-900/90 shadow-md transition-all cursor-pointer hover:scale-[1.01] ${task.completed ? 'border-emerald-500/20 opacity-70' : 'border-white/10 hover:border-indigo-500/40'}`}
                    >
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {task.subject}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/20 hover:border-indigo-500/50'}`}
                          >
                            {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        </div>

                        <p className={`text-xs font-bold leading-snug ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {task.title}
                        </p>

                        {task.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Subtasks Progress */}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
                            <CheckSquare className="w-3 h-3 text-indigo-400" />
                            <span>
                              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                            </span>
                          </div>
                        )}

                        {/* Move Column Selector & Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[9px] text-slate-400">
                          <div className="flex items-center gap-1">
                            {task.priority === 'urgent' && <span className="w-2 h-2 rounded-full bg-rose-500" title="Urgent" />}
                            {task.priority === 'high' && <span className="w-2 h-2 rounded-full bg-amber-500" title="High" />}
                            {task.priority === 'medium' && <span className="w-2 h-2 rounded-full bg-indigo-500" title="Medium" />}
                            {task.priority === 'low' && <span className="w-2 h-2 rounded-full bg-slate-500" title="Low" />}
                            <span className="font-mono text-[9px]">
                              {task.dueDate ? task.dueDate : 'No date'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {col.id !== 'todo' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMoveKanban(task, 'todo'); }}
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
                                title="Move to To Do"
                              >
                                ← ToDo
                              </button>
                            )}
                            {col.id !== 'in_progress' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMoveKanban(task, 'in_progress'); }}
                                className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
                                title="Move to In Progress"
                              >
                                Prog
                              </button>
                            )}
                            {col.id !== 'completed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMoveKanban(task, 'completed'); }}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                                title="Move to Completed"
                              >
                                Done ✓
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-3">
          <Reorder.Group axis="y" values={filteredTasks} onReorder={handleReorder} className="space-y-3">
            {filteredTasks.map(task => {
              const isOverdue = task.dueDate && task.dueDate < todayStr && !task.completed;
              return (
                <Reorder.Item
                  key={task.id}
                  value={task}
                  className="group relative"
                >
                  <div
                    onClick={() => setSelectedTask(task)}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${task.completed ? 'bg-slate-950/40 border-white/5' : isOverdue ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50' : 'bg-slate-900 border-white/10 hover:border-indigo-500/40'}`}
                  >
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                        className={`mt-0.5 sm:mt-0 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${task.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/20 hover:border-indigo-500/50 hover:bg-indigo-500/10'}`}
                      >
                        {task.completed && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                            {task.subject}
                          </span>
                          
                          {task.priority === 'urgent' && (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <AlertCircle className="w-2.5 h-2.5" /> Urgent
                            </span>
                          )}
                          {task.priority === 'high' && (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              <Flag className="w-2.5 h-2.5" /> High
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                              Overdue
                            </span>
                          )}

                          {task.tags && task.tags.map(t => (
                            <span key={t} className="text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
                              #{t}
                            </span>
                          ))}
                        </div>

                        <h4 className={`text-sm font-bold truncate transition-all ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {task.title}
                        </h4>

                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            <CheckSquare className="w-3 h-3 text-indigo-400" />
                            <span>
                              Subtasks: {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{task.dueDate || 'No date'}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundService.playButtonClick();
                          onNavigateTab('study_hub', 'planner');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 hover:bg-indigo-600/20 transition-all flex items-center gap-1"
                        title="Schedule in Study Planner"
                      >
                        <CalendarRange className="w-3 h-3" />
                        <span className="hidden sm:inline">Schedule</span>
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          {filteredTasks.length === 0 && (
            <div className="py-20 text-center space-y-4 rounded-3xl border-2 border-dashed border-white/5 bg-slate-900/20">
              <div className="text-4xl">🎯</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">No tasks match your criteria</p>
                <p className="text-xs text-slate-500">Add a new objective or clear your search filters.</p>
              </div>
              <button
                onClick={() => setIsQuickAdding(true)}
                className="text-xs font-black text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
              >
                Create new task
              </button>
            </div>
          )}
        </div>
      )}

      {/* TASK DETAIL & EDIT DRAWER */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-end"
            onClick={() => setSelectedTask(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xl h-full bg-slate-900 border-l border-white/10 p-6 overflow-y-auto space-y-6 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase">
                    Task Inspector
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    ID: {selectedTask.id.slice(0, 8)}...
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Checkbox */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTask(selectedTask.id)}
                    className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${selectedTask.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/20 hover:border-indigo-500/50'}`}
                  >
                    {selectedTask.completed && <Check className="w-5 h-5 stroke-[3]" />}
                  </button>
                  <input
                    type="text"
                    value={selectedTask.title}
                    onChange={e => handleUpdateSelectedTask({ ...selectedTask, title: e.target.value })}
                    className="flex-1 bg-transparent text-lg font-black text-white focus:outline-none focus:border-b focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes / Instructions</label>
                  <textarea
                    rows={3}
                    value={selectedTask.description || ''}
                    onChange={e => handleUpdateSelectedTask({ ...selectedTask, description: e.target.value })}
                    placeholder="Add detailed instructions, textbook page numbers, or links..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950 rounded-2xl border border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</label>
                  <select
                    value={selectedTask.subject}
                    onChange={e => handleUpdateSelectedTask({ ...selectedTask, subject: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
                  >
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priority</label>
                  <select
                    value={selectedTask.priority || 'medium'}
                    onChange={e => handleUpdateSelectedTask({ ...selectedTask, priority: e.target.value as Priority, category: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
                  >
                    {priorities.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={selectedTask.dueDate || ''}
                    onChange={e => handleUpdateSelectedTask({ ...selectedTask, dueDate: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Est. Duration (Mins)</label>
                  <input
                    type="number"
                    value={selectedTask.estimatedMinutes || 30}
                    onChange={e => handleUpdateSelectedTask({ ...selectedTask, estimatedMinutes: Number(e.target.value) || 0 })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Subtasks Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center justify-between">
                  <span>Subtasks & Checklist</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {selectedTask.subtasks?.filter(s => s.completed).length || 0}/
                    {selectedTask.subtasks?.length || 0}
                  </span>
                </h4>

                <div className="space-y-2">
                  {selectedTask.subtasks?.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-white/5">
                      <button
                        onClick={() => handleToggleSubtask(sub.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${sub.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/20'}`}
                      >
                        {sub.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <span className={`text-xs flex-1 ${sub.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {sub.title}
                      </span>
                      <button onClick={() => handleRemoveSubtask(sub.id)} className="text-slate-500 hover:text-rose-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add subtask step..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                  />
                  <button
                    onClick={handleAddSubtask}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-white tracking-wider">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.tags?.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-1.5 font-mono">
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-rose-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    placeholder="New tag..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                  >
                    Add Tag
                  </button>
                </div>
              </div>

              {/* Deep Cross-Module Actions */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    onNavigateTab('study_hub', 'planner');
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <CalendarRange className="w-4 h-4" /> Schedule Session in Study Planner
                </button>
                
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    onNavigateTab('study_hub', 'flashcards');
                  }}
                  className="w-full py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-300 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4" /> Open Flashcards Revision
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
