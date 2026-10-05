/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Academic Gamification UI Suite
 * Includes:
 * 1. GamificationRewardToast — Global floating XP / Level-Up / Badge-Unlock notification
 * 2. DashboardGamificationCard — Compact Student Dashboard XP, Streak, Badges & Rank card
 * 3. StudentGamificationHub — Full Achievements, 10-Level Roadmap & Class/School Leaderboard
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Flame,
  Sparkles,
  Award,
  TrendingUp,
  CheckCircle2,
  Lock,
  ChevronRight,
  Crown,
  Zap,
  BookOpen,
  Star,
  Users,
  School,
  X
} from 'lucide-react';
import {
  SCHOLAR_LEVELS,
  GAMIFICATION_BADGES,
  XP_REWARDS,
  StudentGamificationStats,
  LevelDefinition,
  BadgeDefinition,
  calculateLevelInfo,
  getLocalGamificationProfile,
  fetchGamificationLeaderboard,
  awardStudentXP
} from '../lib/gamification';
import { UserProfile } from '../types';

interface ToastEventDetail {
  xpAdded: number;
  label: string;
  leveledUp: boolean;
  newLevel?: LevelDefinition;
  newBadges: BadgeDefinition[];
  totalXp: number;
  streak: number;
}

/**
 * 1. Global Non-Intrusive XP & Level-Up Toast
 */
export const GamificationRewardToast: React.FC = () => {
  const [toast, setToast] = useState<ToastEventDetail | null>(null);

  useEffect(() => {
    let timer: any;
    const handleXpToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastEventDetail>).detail;
      if (!detail) return;
      setToast(detail);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setToast(null);
      }, detail.leveledUp || (detail.newBadges && detail.newBadges.length > 0) ? 5500 : 3500);
    };

    window.addEventListener('studentos-xp-toast', handleXpToast);
    return () => {
      window.removeEventListener('studentos-xp-toast', handleXpToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] pointer-events-auto animate-bounceOnce">
      <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-amber-500/50 rounded-2xl px-5 py-3.5 shadow-2xl shadow-amber-500/20 flex items-center gap-4 min-w-[300px] max-w-md">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/30 shrink-0">
          {toast.leveledUp ? '👑' : toast.newBadges?.length > 0 ? toast.newBadges[0].icon : '⚡'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs">
              +{toast.xpAdded} XP
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              Total: {toast.totalXp} XP
            </span>
            {toast.streak > 0 && (
              <span className="text-[11px] font-bold text-orange-400 flex items-center gap-0.5">
                🔥 {toast.streak}d
              </span>
            )}
          </div>
          <p className="text-xs font-extrabold text-white mt-1 truncate">
            {toast.label}
          </p>
          {toast.leveledUp && toast.newLevel && (
            <p className="text-[11px] font-black text-amber-300 mt-0.5">
              🎉 LEVEL UP! Reached Level {toast.newLevel.level}: {toast.newLevel.title}!
            </p>
          )}
          {toast.newBadges && toast.newBadges.length > 0 && (
            <p className="text-[11px] font-black text-emerald-300 mt-0.5">
              🏅 Badge Unlocked: {toast.newBadges.map(b => b.name).join(', ')}!
            </p>
          )}
        </div>
        <button
          onClick={() => setToast(null)}
          className="text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * 2. Compact Student Dashboard Gamification Summary Card
 */
export const DashboardGamificationCard: React.FC<{
  currentUser: UserProfile;
  onOpenFullHub?: () => void;
}> = ({ currentUser, onOpenFullHub }) => {
  const [profile, setProfile] = useState<StudentGamificationStats>(() =>
    getLocalGamificationProfile(currentUser)
  );
  const [rankInfo, setRankInfo] = useState<{ classRank: number; schoolRank: number; totalSchool: number }>({
    classRank: 1,
    schoolRank: 1,
    totalSchool: 10
  });
  const [showFullModal, setShowFullModal] = useState(false);

  const refreshData = async () => {
    const p = getLocalGamificationProfile(currentUser);
    setProfile(p);
    const lb = await fetchGamificationLeaderboard(currentUser);
    const sIdx = lb.findIndex(item => item.userId === p.userId);
    const classLb = lb.filter(
      item =>
        (item.grade || '').toLowerCase() === (p.grade || '').toLowerCase()
    );
    const cIdx = classLb.findIndex(item => item.userId === p.userId);
    setRankInfo({
      classRank: cIdx >= 0 ? cIdx + 1 : 1,
      schoolRank: sIdx >= 0 ? sIdx + 1 : 1,
      totalSchool: lb.length
    });
  };

  useEffect(() => {
    // Award daily check-in XP automatically once per day
    awardStudentXP(currentUser, 'daily_login', { silent: false }).then(() => {
      refreshData();
    });

    const handleUpdate = () => refreshData();
    window.addEventListener('studentos-gamification-updated', handleUpdate);
    return () => window.removeEventListener('studentos-gamification-updated', handleUpdate);
  }, [currentUser?.uid]);

  const levelInfo = useMemo(() => calculateLevelInfo(profile.xp), [profile.xp]);
  const earnedBadgesList = useMemo(
    () => GAMIFICATION_BADGES.filter(b => Boolean(profile.earnedBadges[b.id])),
    [profile.earnedBadges]
  );

  const handleOpenHub = () => {
    if (onOpenFullHub) {
      onOpenFullHub();
    } else {
      setShowFullModal(true);
    }
  };

  return (
    <>
      <div className="smart-glass p-5 sm:p-6 rounded-3xl border border-amber-500/25 bg-gradient-to-br from-slate-900/95 via-indigo-950/40 to-amber-950/20 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left: Level Badge + XP Progress */}
          <div className="lg:col-span-5 flex items-center gap-4">
            <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${levelInfo.current.color} flex flex-col items-center justify-center shadow-lg border border-white/20 shrink-0`}>
              <span className="text-2xl leading-none">{levelInfo.current.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-wider text-white/90 mt-1">
                LVL {levelInfo.current.level}
              </span>
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                    Scholar Progression
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white truncate">
                    Level {levelInfo.current.level} — {levelInfo.current.title}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black text-xs shrink-0">
                  {profile.xp.toLocaleString()} XP
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-950/90 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-500 transition-all duration-700"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                {levelInfo.next ? (
                  <>
                    <span>{levelInfo.progressPercent}% to Level {levelInfo.next.level} ({levelInfo.next.title})</span>
                    <span className="text-amber-300 font-bold">{levelInfo.xpRequiredForNext} XP needed</span>
                  </>
                ) : (
                  <span className="text-amber-300 font-bold">👑 Maximum Level Reached — Campus Legend!</span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Streak, Rank & Badges Preview */}
          <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
            {/* Streak */}
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-orange-500/25 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Study Streak
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-lg sm:text-xl font-black text-orange-400">
                  🔥 {profile.currentStreak}
                </span>
                <span className="text-[11px] font-bold text-slate-300">
                  {profile.currentStreak === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Best: {profile.longestStreak}d
              </span>
            </div>

            {/* Class Rank */}
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-indigo-500/25 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Class Rank
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg sm:text-xl font-black text-indigo-400">
                  #{rankInfo.classRank}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold truncate">
                  in {profile.grade || 'Class'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                School #{rankInfo.schoolRank}
              </span>
            </div>

            {/* Earned Badges */}
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/25 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Badges
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-lg sm:text-xl font-black text-emerald-400">
                  {earnedBadgesList.length}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  / {GAMIFICATION_BADGES.length}
                </span>
              </div>
              <div className="flex items-center -space-x-1 overflow-hidden mt-0.5">
                {earnedBadgesList.length > 0 ? (
                  earnedBadgesList.slice(0, 4).map(b => (
                    <span key={b.id} title={b.name} className="text-xs">
                      {b.icon}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-500">Unlock now</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action CTA */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleOpenHub}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span>Leaderboard & Badges</span>
            </button>
            <div className="text-[10px] text-center text-slate-400 font-medium">
              Today: <span className="text-emerald-400 font-bold">+{profile.dailyTrackers.xpEarnedToday} XP</span> earned
            </div>
          </div>
        </div>
      </div>

      {/* Full Modal when opened directly from Dashboard */}
      {showFullModal && (
        <div className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-6xl bg-slate-950 border border-white/10 rounded-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 relative shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 sticky top-0 bg-slate-950/95 backdrop-blur-md z-20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">StudentOS Scholar Gamification & Leaderboard</h2>
                  <p className="text-xs text-slate-400">Academic XP, Daily Streaks, Merit Badges & Class Standings</p>
                </div>
              </div>
              <button
                onClick={() => setShowFullModal(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <StudentGamificationHub currentUser={currentUser} />
          </div>
        </div>
      )}
    </>
  );
};

/**
 * 3. Full StudentOS Gamification & Leaderboard Arena
 */
export const StudentGamificationHub: React.FC<{
  currentUser: UserProfile;
}> = ({ currentUser }) => {
  const [profile, setProfile] = useState<StudentGamificationStats>(() =>
    getLocalGamificationProfile(currentUser)
  );
  const [leaderboard, setLeaderboard] = useState<StudentGamificationStats[]>([]);
  const [scope, setScope] = useState<'class' | 'school'>('class');
  const [activeSection, setActiveSection] = useState<'overview' | 'leaderboard' | 'badges' | 'levels'>('overview');

  const loadData = async () => {
    const localProf = getLocalGamificationProfile(currentUser);
    setProfile(localProf);
    const lb = await fetchGamificationLeaderboard(currentUser);
    setLeaderboard(lb);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('studentos-gamification-updated', handleUpdate);
    return () => window.removeEventListener('studentos-gamification-updated', handleUpdate);
  }, [currentUser?.uid]);

  const levelInfo = useMemo(() => calculateLevelInfo(profile.xp), [profile.xp]);

  const filteredLeaderboard = useMemo(() => {
    if (scope === 'school') return leaderboard;
    const targetGrade = (profile.grade || 'Grade 10').toLowerCase().replace(/class|grade|\s+/g, '');
    const classMatches = leaderboard.filter(item => {
      const g = (item.grade || '').toLowerCase().replace(/class|grade|\s+/g, '');
      return !targetGrade || g === targetGrade || g.includes(targetGrade);
    });
    return classMatches.length > 0 ? classMatches : leaderboard;
  }, [leaderboard, scope, profile.grade]);

  const myRank = useMemo(() => {
    const idx = filteredLeaderboard.findIndex(i => i.userId === profile.userId);
    return idx >= 0 ? idx + 1 : filteredLeaderboard.length + 1;
  }, [filteredLeaderboard, profile.userId]);

  const top3 = filteredLeaderboard.slice(0, 3);
  const top10 = filteredLeaderboard.slice(0, 10);

  const getBadgeProgress = (badgeId: string): { current: number; max: number } => {
    switch (badgeId) {
      case 'first_steps':
        return { current: Math.min(1, profile.counts.totalActions), max: 1 };
      case 'streak_3':
        return { current: Math.min(3, Math.max(profile.currentStreak, profile.longestStreak)), max: 3 };
      case 'streak_7':
        return { current: Math.min(7, Math.max(profile.currentStreak, profile.longestStreak)), max: 7 };
      case 'homework_hero':
        return { current: Math.min(5, profile.counts.homeworkCompleted), max: 5 };
      case 'flashcard_master':
        return { current: Math.min(50, profile.counts.flashcardsStudied), max: 50 };
      case 'quiz_champion':
        return { current: Math.min(1, profile.counts.highScoreQuizzes), max: 1 };
      case 'note_taker':
        return { current: Math.min(5, profile.counts.notesCreated), max: 5 };
      case 'ai_explorer':
        return { current: Math.min(10, profile.counts.aiStudyUses), max: 10 };
      case 'top_10_scholar':
        return { current: myRank <= 10 && profile.xp >= 50 ? 1 : 0, max: 1 };
      default:
        return { current: 0, max: 1 };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-amber-950/60 border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          <div className="lg:col-span-6 flex items-center gap-5">
            <div className={`h-20 w-20 rounded-3xl bg-gradient-to-br ${levelInfo.current.color} flex flex-col items-center justify-center shadow-2xl border-2 border-white/20 shrink-0`}>
              <span className="text-3xl">{levelInfo.current.icon}</span>
              <span className="text-[10px] font-black uppercase text-white mt-1">
                Level {levelInfo.current.level}
              </span>
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  {levelInfo.current.title}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[10px] font-black">
                  🔥 {profile.currentStreak} Day Study Streak
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                {profile.name}
              </h2>
              <div className="w-full bg-slate-950/80 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-500 transition-all duration-700"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-300 flex items-center justify-between">
                <span>
                  <strong className="text-amber-300">{profile.xp.toLocaleString()} XP</strong> Total
                </span>
                {levelInfo.next ? (
                  <span>
                    Next: <strong>Level {levelInfo.next.level} ({levelInfo.next.title})</strong> in {levelInfo.xpRequiredForNext} XP
                  </span>
                ) : (
                  <span className="text-amber-300 font-bold">Max Level Achieved!</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Leaderboard Rank</p>
              <p className="text-xl font-black text-indigo-400 mt-1">#{myRank}</p>
              <p className="text-[10px] text-slate-500">{scope === 'class' ? profile.grade : 'School-Wide'}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Current Streak</p>
              <p className="text-xl font-black text-orange-400 mt-1">🔥 {profile.currentStreak}d</p>
              <p className="text-[10px] text-slate-500">Longest: {profile.longestStreak}d</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Earned Badges</p>
              <p className="text-xl font-black text-emerald-400 mt-1">
                {Object.keys(profile.earnedBadges).length}/{GAMIFICATION_BADGES.length}
              </p>
              <p className="text-[10px] text-slate-500">Merit Collection</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Today's XP</p>
              <p className="text-xl font-black text-amber-400 mt-1">+{profile.dailyTrackers.xpEarnedToday}</p>
              <p className="text-[10px] text-slate-500">AI Uses: {profile.dailyTrackers.aiUsesToday}/5</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'overview', label: '⚡ Overview & Today\'s Goals' },
          { id: 'leaderboard', label: '🏆 Class & School Leaderboard' },
          { id: 'badges', label: `🏅 Achievements (${Object.keys(profile.earnedBadges).length}/${GAMIFICATION_BADGES.length})` },
          { id: 'levels', label: '📈 10-Level Scholar Roadmap' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSection === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: OVERVIEW & TODAY'S GOALS */}
      {(activeSection === 'overview' || activeSection === 'leaderboard') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Leaderboard Column */}
          <div className="lg:col-span-7 smart-glass p-6 rounded-3xl border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Academic Scholar Leaderboard
                </h3>
                <p className="text-xs text-slate-400">
                  Ranked by verified academic XP, study streaks, and quiz mastery
                </p>
              </div>

              {/* Filter: My Class vs School */}
              <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-white/10 self-start">
                <button
                  onClick={() => setScope('class')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    scope === 'class' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>My Class ({profile.grade || 'Grade 10'})</span>
                </button>
                <button
                  onClick={() => setScope('school')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    scope === 'school' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>Whole School</span>
                </button>
              </div>
            </div>

            {/* Top 3 Podium */}
            {top3.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 pt-2 items-end">
                {/* 2nd Place */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-400/30 text-center space-y-1.5">
                  <div className="text-xl">🥈</div>
                  <p className="text-xs font-black text-white truncate">{top3[1].name}</p>
                  <p className="text-[10px] text-slate-400">Lvl {top3[1].level} • {top3[1].levelTitle}</p>
                  <p className="text-xs font-black text-slate-200">{top3[1].xp.toLocaleString()} XP</p>
                </div>

                {/* 1st Place */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/20 to-slate-900 border-2 border-amber-400/50 text-center space-y-1.5 shadow-xl shadow-amber-500/10 -translate-y-1">
                  <div className="text-2xl">👑</div>
                  <p className="text-xs sm:text-sm font-black text-amber-300 truncate">{top3[0].name}</p>
                  <p className="text-[10px] text-amber-200/80">Lvl {top3[0].level} • {top3[0].levelTitle}</p>
                  <p className="text-sm font-black text-white">{top3[0].xp.toLocaleString()} XP</p>
                </div>

                {/* 3rd Place */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-700/40 text-center space-y-1.5">
                  <div className="text-xl">🥉</div>
                  <p className="text-xs font-black text-white truncate">{top3[2].name}</p>
                  <p className="text-[10px] text-slate-400">Lvl {top3[2].level} • {top3[2].levelTitle}</p>
                  <p className="text-xs font-black text-amber-400">{top3[2].xp.toLocaleString()} XP</p>
                </div>
              </div>
            )}

            {/* Top 10 List */}
            <div className="space-y-2">
              {top10.map((scholar, index) => {
                const isMe = scholar.userId === profile.userId;
                return (
                  <div
                    key={scholar.userId}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                      isMe
                        ? 'bg-indigo-600/20 border-indigo-400/50 shadow-lg'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          index === 0
                            ? 'bg-amber-500 text-slate-950'
                            : index === 1
                              ? 'bg-slate-300 text-slate-950'
                              : index === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate flex items-center gap-1.5">
                          <span>{scholar.name}</span>
                          {isMe && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500 text-white text-[9px] uppercase">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Level {scholar.level} ({scholar.levelTitle}) • {scholar.grade} {scholar.section}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-bold text-orange-400">
                        🔥 {scholar.currentStreak}d
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-white/10 text-xs font-black text-amber-300">
                        {scholar.xp.toLocaleString()} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Student's Rank Footer (always visible) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950 to-slate-900 border border-indigo-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500 text-white font-black text-xs">
                  Your Rank: #{myRank}
                </span>
                <span className="text-xs font-bold text-white">{profile.name}</span>
              </div>
              <span className="text-xs font-black text-amber-300">
                {profile.xp.toLocaleString()} XP • Lvl {profile.level}
              </span>
            </div>
          </div>

          {/* Right Column: Today's Study Goals & Recent XP Log */}
          <div className="lg:col-span-5 space-y-6">
            {/* How to Earn XP / Daily Quests */}
            <div className="smart-glass p-6 rounded-3xl border border-white/10 space-y-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Academic XP Rewards & Daily Quests
                </h3>
                <p className="text-xs text-slate-400">
                  Complete real learning activities across StudentOS to level up
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    title: 'Daily Study Check-In',
                    xp: '+10 XP',
                    done: profile.dailyTrackers.loginClaimed,
                    sub: 'Once per day on login'
                  },
                  {
                    title: 'Complete Homework / Assignment',
                    xp: '+25 XP',
                    done: profile.counts.homeworkCompleted > 0,
                    sub: `${profile.counts.homeworkCompleted} completed total`
                  },
                  {
                    title: 'Study Flashcard Deck',
                    xp: '+15 XP',
                    done: profile.counts.flashcardsStudied > 0,
                    sub: `${profile.counts.flashcardsStudied} cards studied`
                  },
                  {
                    title: 'Complete Practice Quiz (80%+ Bonus)',
                    xp: '+30 / +50 XP',
                    done: profile.counts.quizzesCompleted > 0,
                    sub: '+20 bonus XP for scoring above 80%'
                  },
                  {
                    title: 'Create Study Note',
                    xp: '+15 XP',
                    done: profile.counts.notesCreated > 0,
                    sub: `${profile.counts.notesCreated} notes created`
                  },
                  {
                    title: 'Use NVIDIA AI Buddy / Orion Tutor',
                    xp: '+10 XP',
                    done: profile.dailyTrackers.aiUsesToday > 0,
                    sub: `${profile.dailyTrackers.aiUsesToday}/5 daily AI study rewards claimed`
                  },
                  {
                    title: 'Read Official School Notice',
                    xp: '+5 XP',
                    done: profile.counts.noticesRead > 0,
                    sub: `${profile.counts.noticesRead} notices read`
                  }
                ].map((goal, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          goal.done ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{goal.title}</p>
                        <p className="text-[10px] text-slate-400">{goal.sub}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black text-[11px] shrink-0">
                      {goal.xp}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent XP Activity */}
            <div className="smart-glass p-6 rounded-3xl border border-white/10 space-y-3">
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                Recent XP Activity Log
              </h4>
              {profile.recentXpHistory.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {profile.recentXpHistory.slice(0, 8).map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-200 font-semibold truncate">{item.label}</span>
                      <span className="text-amber-400 font-black shrink-0">+{item.xp} XP</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Complete your first study action to log XP!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ACHIEVEMENTS & BADGES GRID */}
      {(activeSection === 'overview' || activeSection === 'badges') && (
        <div className="smart-glass p-6 rounded-3xl border border-white/10 space-y-5">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Scholar Achievements & Merit Badges
            </h3>
            <p className="text-xs text-slate-400">
              Earned badges are highlighted in gold & emerald; locked badges show your progress toward unlocking
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GAMIFICATION_BADGES.map(badge => {
              const unlockedAt = profile.earnedBadges[badge.id];
              const isUnlocked = Boolean(unlockedAt);
              const prog = getBadgeProgress(badge.id);
              const pct = Math.min(100, Math.round((prog.current / prog.max) * 100));

              return (
                <div
                  key={badge.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isUnlocked
                      ? 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-amber-950/40 border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950/60 border-white/10 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${
                        isUnlocked
                          ? 'bg-emerald-500/20 border-emerald-400/40 shadow-md'
                          : 'bg-slate-900 border-white/10 grayscale'
                      }`}
                    >
                      {badge.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black text-white truncate">{badge.name}</h4>
                        {isUnlocked ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase">
                            Earned
                          </span>
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{badge.description}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-semibold">{badge.unlockRequirement}</span>
                      <span className={isUnlocked ? 'text-emerald-400 font-black' : 'text-slate-400 font-bold'}>
                        {prog.current}/{prog.max}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isUnlocked ? 'bg-emerald-400' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: 10-LEVEL SCHOLAR ROADMAP */}
      {activeSection === 'levels' && (
        <div className="smart-glass p-6 rounded-3xl border border-white/10 space-y-5">
          <div>
            <h3 className="text-lg font-black text-white">10-Level StudentOS Scholar Progression</h3>
            <p className="text-xs text-slate-400">
              Advance from Level 1 Rookie Scholar to Level 10 Campus Legend through consistent study
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {SCHOLAR_LEVELS.map(lvl => {
              const reached = profile.xp >= lvl.minXp;
              const isCurrent = levelInfo.current.level === lvl.level;
              return (
                <div
                  key={lvl.level}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-br from-amber-500/20 to-indigo-950 border-2 border-amber-400 shadow-xl'
                      : reached
                        ? 'bg-slate-900/90 border-emerald-500/40'
                        : 'bg-slate-950/60 border-white/10 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{lvl.icon}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        isCurrent
                          ? 'bg-amber-400 text-slate-950'
                          : reached
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCurrent ? 'Current' : reached ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase mt-3">Level {lvl.level}</p>
                  <h4 className="text-sm font-black text-white mt-0.5">{lvl.title}</h4>
                  <p className="text-xs font-bold text-amber-300 mt-2">{lvl.minXp.toLocaleString()} XP</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
