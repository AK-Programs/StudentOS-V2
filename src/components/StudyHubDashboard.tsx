import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  Calendar,
  ArrowRight,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, FlashcardDeck, Task } from '../types';
import { fetchSupabaseDecks, getCanonicalUserId } from '../lib/flashcardStorage';
import { SyllabusTimetableService } from '../lib/syllabusTimetableService';
import { StudySessionItem } from '../types/syllabusTimetable';
import { VeylentraIcon } from './ui/VeylentraIcon';
import { soundService } from '../lib/soundService';

interface StudyHubDashboardProps {
  currentUser: UserProfile;
  onNavigateTab: (tab: string, subTab?: string, contextId?: string) => void;
  dueCardsCount: number;
  tasks: Task[];
}

export const StudyHubDashboard: React.FC<StudyHubDashboardProps> = ({
  currentUser,
  onNavigateTab,
  dueCardsCount,
  tasks
}) => {
  const userId = getCanonicalUserId(currentUser?.uid || currentUser?.email);

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [sessions, setSessions] = useState<StudySessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [fetchedDecks, fetchedSessions] = await Promise.all([
          fetchSupabaseDecks(userId),
          SyllabusTimetableService.getStudySessions(userId)
        ]);
        if (!mounted) return;
        setDecks(fetchedDecks);
        setSessions(fetchedSessions);
      } catch (error) {
        console.error('[StudyHub] Dashboard data load error:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks]);
  const activeSessions = useMemo(() => sessions.filter(s => s.status === 'pending'), [sessions]);
  const completedSessions = useMemo(() => sessions.filter(s => s.status === 'completed'), [sessions]);

  const totalDecksCardsEstimate = useMemo(() => {
    const sum = decks.reduce((acc, d) => acc + (d.cardCount || 0), 0);
    return Math.max(sum, dueCardsCount);
  }, [decks, dueCardsCount]);

  const masteryRatio = useMemo(() => {
    if (totalDecksCardsEstimate === 0) return dueCardsCount === 0 ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round(((totalDecksCardsEstimate - dueCardsCount) / totalDecksCardsEstimate) * 100)));
  }, [totalDecksCardsEstimate, dueCardsCount]);

  const activityChartData = useMemo(() => {
    return [
      { label: 'Tasks Done', value: completedTasks.length, color: '#10b981' },
      { label: 'Tasks Open', value: pendingTasks.length, color: '#3b82f6' },
      { label: 'Sessions Done', value: completedSessions.length, color: '#0ea5e9' },
      { label: 'Cards Due', value: dueCardsCount, color: '#f59e0b' }
    ];
  }, [completedTasks.length, pendingTasks.length, completedSessions.length, dueCardsCount]);

  const quickActions: Array<{
    id: string;
    label: string;
    iconName: 'tasks' | 'syllabus' | 'calendar';
    styleClass: string;
    action: () => void;
  }> = [
    {
      id: 'tasks',
      label: 'Create Study Task',
      iconName: 'tasks',
      styleClass: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/40',
      action: () => onNavigateTab('study_hub', 'tasks')
    },
    {
      id: 'flashcards',
      label: 'Review Flashcard Decks',
      iconName: 'syllabus',
      styleClass: 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-white/10',
      action: () => onNavigateTab('study_hub', 'flashcards')
    },
    {
      id: 'planner',
      label: 'Schedule Study Block',
      iconName: 'calendar',
      styleClass: 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-white/10',
      action: () => onNavigateTab('study_hub', 'planner')
    }
  ];

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Loading study workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Structured Workspace Header */}
      <div className="bento-card rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-blue-400 font-semibold">
            <VeylentraIcon name="study_hub" size="xs" />
            <span>Study Space Overview</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">{decks.length} deck{decks.length === 1 ? '' : 's'} synced</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-white tracking-tight">
            Focused Daily Study Workspace
          </h2>
          <p className="text-slate-400 max-w-xl text-xs sm:text-sm leading-relaxed">
            Review due spaced-repetition cards, prioritize pending tasks, and track scheduled study blocks in one calm workspace.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 shrink-0">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 text-left min-w-[96px]">
            <span className="text-[11px] font-medium text-slate-400 block">Due Cards</span>
            <span className="text-2xl font-bold text-white tabular-nums mt-0.5 block">{dueCardsCount}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 text-left min-w-[96px]">
            <span className="text-[11px] font-medium text-slate-400 block">Open Tasks</span>
            <span className="text-2xl font-bold text-white tabular-nums mt-0.5 block">{pendingTasks.length}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 text-left min-w-[96px]">
            <span className="text-[11px] font-medium text-slate-400 block">Streak</span>
            <span className="text-2xl font-bold text-emerald-400 tabular-nums mt-0.5 block">
              {currentUser.streakDays || 0}d
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Today's Tasks, Scheduled Sessions & Real Activity Chart */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bento-card rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <VeylentraIcon name="target" size="sm" />
                <div>
                  <h3 className="text-base font-bold text-white">Today&apos;s Priorities &amp; Study Blocks</h3>
                  <p className="text-xs text-slate-400">Live tasks and scheduled focus sessions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('study_hub', 'planner')}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Planner</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Priority Tasks */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Priority Tasks ({pendingTasks.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('study_hub', 'tasks')}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>All</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {pendingTasks.slice(0, 3).map(task => (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => onNavigateTab('study_hub', 'tasks')}
                      className="w-full text-left p-3 rounded-xl bg-slate-950/75 border border-white/10 hover:border-blue-500/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            task.priority === 'high'
                              ? 'bg-rose-400'
                              : task.priority === 'medium'
                              ? 'bg-amber-400'
                              : 'bg-blue-400'
                          }`}
                        />
                        <span className="text-xs font-semibold text-slate-200 truncate">{task.title}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 capitalize shrink-0">
                        {task.priority || 'normal'}
                      </span>
                    </button>
                  ))}
                  {pendingTasks.length === 0 && (
                    <div className="p-5 text-center rounded-xl border border-dashed border-white/10 bg-slate-950/40">
                      <p className="text-xs text-slate-400">No pending tasks right now.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Planned Study Sessions */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    Study Sessions ({activeSessions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('study_hub', 'planner')}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Schedule</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {activeSessions.slice(0, 3).map(sess => (
                    <button
                      type="button"
                      key={sess.id}
                      onClick={() => onNavigateTab('study_hub', 'planner')}
                      className="w-full text-left p-3 rounded-xl bg-slate-950/75 border border-white/10 hover:border-blue-500/40 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[11px] font-semibold text-blue-400">{sess.subject}</span>
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          {sess.startTime} · {sess.durationMinutes}m
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {sess.chapterTitle || sess.sessionType.replace(/_/g, ' ')}
                      </p>
                    </button>
                  ))}
                  {activeSessions.length === 0 && (
                    <div className="p-5 text-center rounded-xl border border-dashed border-white/10 bg-slate-950/40">
                      <p className="text-xs text-slate-400">No upcoming study blocks scheduled.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Live Study Activity Chart (Recharts) */}
          <div className="bento-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Study Workload Balance</h3>
                <p className="text-xs text-slate-400">Computed from live tasks, planner sessions, and spaced-repetition cards</p>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {completedTasks.length + completedSessions.length} completed
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                    {activityChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Quick Actions & Active Recall Coverage */}
        <div className="space-y-5">
          <div className="bento-card rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Quick Actions</h4>
            <div className="space-y-2">
              {quickActions.map(action => (
                <button
                  type="button"
                  key={action.id}
                  onClick={() => {
                    soundService.playButtonClick();
                    action.action();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border font-semibold text-xs transition-colors cursor-pointer ${action.styleClass}`}
                >
                  <div className="flex items-center gap-2.5">
                    <VeylentraIcon name={action.iconName} size="xs" />
                    <span>{action.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>
              ))}
            </div>
          </div>

          {/* Accurate Active Recall Status */}
          <div
            onClick={() => onNavigateTab('study_hub', 'flashcards', 'all-due')}
            className="bento-card rounded-2xl p-5 cursor-pointer hover:border-blue-500/40 transition-colors space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <VeylentraIcon name="quiz" size="md" />
                <div>
                  <h4 className="text-sm font-bold text-white">Active Recall Queue</h4>
                  <p className="text-xs text-slate-400">
                    {totalDecksCardsEstimate} total card{totalDecksCardsEstimate === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs tabular-nums ${
                  dueCardsCount > 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                }`}
              >
                {dueCardsCount} due
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Up-to-date retention</span>
                <span className="font-semibold text-slate-200 tabular-nums">{masteryRatio}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                <div
                  className="bg-teal-500 h-full transition-all duration-500"
                  style={{ width: `${masteryRatio}%` }}
                />
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-xs font-semibold text-blue-400">
              <span>{dueCardsCount > 0 ? 'Start Flashcard Review' : 'Browse Decks'}</span>
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
