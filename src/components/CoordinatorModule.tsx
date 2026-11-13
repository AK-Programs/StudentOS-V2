import React, { useState, useEffect, useMemo } from 'react';
import { Award, AlertTriangle, CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { HouseAnalytics, HouseType, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { saveAppNotification } from '../lib/notifications';
import { getAuthorizedGrades, getAuthorizedSections } from '../config/facultyPermissions';
import { getSectionsForGrade } from '../config/academicHierarchy';
import { VeylentraIcon } from './ui/VeylentraIcon';

interface CoordinatorModuleProps {
  currentUser: UserProfile;
  showNotification: (msg: string) => void;
}

const HOUSE_STORAGE_KEY = 'veylentra_house_points_ledger_v1';

export default function CoordinatorModule({ currentUser, showNotification }: CoordinatorModuleProps) {
  const authorizedGrades = useMemo(() => getAuthorizedGrades(currentUser), [currentUser]);
  const authorizedSections = useMemo(() => getAuthorizedSections(currentUser), [currentUser]);

  const [houses, setHouses] = useState<HouseAnalytics[]>([
    { id: 'Ruby', points: 0, materialsShared: 0, quizzesWon: 0, participation: 0 },
    { id: 'Emerald', points: 0, materialsShared: 0, quizzesWon: 0, participation: 0 },
    { id: 'Sapphire', points: 0, materialsShared: 0, quizzesWon: 0, participation: 0 },
    { id: 'Topaz', points: 0, materialsShared: 0, quizzesWon: 0, participation: 0 }
  ]);
  const [pointsInput, setPointsInput] = useState<number>(10);
  const [targetHouse, setTargetHouse] = useState<HouseType>('Ruby');
  const [reasonInput, setReasonInput] = useState<string>('Academic excellence & peer collaboration');
  const [savingPoints, setSavingPoints] = useState(false);

  const [warnGrade, setWarnGrade] = useState<string>(authorizedGrades[0] || 'Grade 10');
  const [warnSection, setWarnSection] = useState<string>(authorizedSections[0] || 'Solara');
  const [warnMsg, setWarnMsg] = useState<string>('');
  const [sendingNotice, setSendingNotice] = useState(false);
  const [recentActions, setRecentActions] = useState<Array<{ id: string; summary: string; timestamp: string }>>([]);

  const availableSections = useMemo(() => {
    const gradeSecs = getSectionsForGrade(warnGrade);
    if (authorizedSections.length > 0 && currentUser.role === 'coordinator') {
      const intersection = gradeSecs.filter(s =>
        authorizedSections.some(a => a.toLowerCase() === s.toLowerCase())
      );
      return intersection.length > 0 ? intersection : gradeSecs;
    }
    return gradeSecs;
  }, [warnGrade, authorizedSections, currentUser.role]);

  useEffect(() => {
    let mounted = true;
    async function loadRealHouseStandings() {
      try {
        const users = await fetchAllSupabaseUsers();
        const scopedStudents = users.filter(u => u.role === 'student');

        let ledgerBonus: Record<string, number> = {};
        try {
          const { data } = await supabase
            .from('global_data')
            .select('data')
            .eq('id', HOUSE_STORAGE_KEY)
            .maybeSingle();
          if (data?.data && typeof data.data === 'object') {
            ledgerBonus = data.data as Record<string, number>;
          }
        } catch {
          try {
            const localRaw = localStorage.getItem(HOUSE_STORAGE_KEY);
            if (localRaw) ledgerBonus = JSON.parse(localRaw);
          } catch {}
        }

        const houseNames: HouseType[] = ['Ruby', 'Emerald', 'Sapphire', 'Topaz'];
        const computed: HouseAnalytics[] = houseNames.map(houseId => {
          const members = scopedStudents.filter(
            s => (s.house || '').toLowerCase() === houseId.toLowerCase()
          );
          const xpSum = members.reduce((acc, s) => acc + Number((s as any).xp || 0), 0);
          const quizzesWon = members.reduce((acc, s) => acc + Number(s.quizzesTaken || 0), 0);
          const extra = Number(ledgerBonus[houseId] || 0);
          const totalPoints = Math.max(0, Math.round(xpSum / 10) + extra);
          return {
            id: houseId,
            points: totalPoints,
            materialsShared: members.reduce((acc, s) => acc + Number(s.studyHours || 0), 0),
            quizzesWon,
            participation: members.length
          };
        });

        if (mounted) setHouses(computed);
      } catch (err) {
        console.warn('[CoordinatorModule] Could not aggregate house analytics:', err);
      }
    }
    loadRealHouseStandings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAwardPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput.trim() || !pointsInput) {
      showNotification('Please provide a valid point value and reason.');
      return;
    }

    setSavingPoints(true);
    try {
      let existingLedger: Record<string, number> = {};
      try {
        const { data } = await supabase
          .from('global_data')
          .select('data')
          .eq('id', HOUSE_STORAGE_KEY)
          .maybeSingle();
        if (data?.data) existingLedger = data.data as Record<string, number>;
      } catch {}

      const updatedLedger = {
        ...existingLedger,
        [targetHouse]: (Number(existingLedger[targetHouse]) || 0) + Number(pointsInput)
      };

      try {
        await supabase.from('global_data').upsert({
          id: HOUSE_STORAGE_KEY,
          data: updatedLedger,
          updated_at: new Date().toISOString()
        });
      } catch {}
      try {
        localStorage.setItem(HOUSE_STORAGE_KEY, JSON.stringify(updatedLedger));
      } catch {}

      setHouses(prev =>
        prev.map(h => (h.id === targetHouse ? { ...h, points: h.points + Number(pointsInput) } : h))
      );
      setRecentActions(prev => [
        {
          id: `pts-${Date.now()}`,
          summary: `Awarded +${pointsInput} pts to ${targetHouse} (${reasonInput.trim()})`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev.slice(0, 4)
      ]);
      showNotification(`✓ Awarded ${pointsInput} points to ${targetHouse} House.`);
      setReasonInput('');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to record house points.');
    } finally {
      setSavingPoints(false);
    }
  };

  const handleSendSectionNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warnMsg.trim()) {
      showNotification('Please enter a section notice message.');
      return;
    }

    setSendingNotice(true);
    try {
      await saveAppNotification({
        id: `coord_notice_${Date.now()}`,
        title: `Coordinator Notice · ${warnGrade} (${warnSection})`,
        message: `${warnMsg.trim()} — ${currentUser.name || 'Academic Coordinator'}`,
        type: 'announcement',
        targetUserId: 'all',
        targetClass: warnGrade,
        targetSection: warnSection,
        targetRole: 'student',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTab: 'notice_viewer'
      });
      setRecentActions(prev => [
        {
          id: `notice-${Date.now()}`,
          summary: `Dispatched notice to ${warnGrade} · ${warnSection}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev.slice(0, 4)
      ]);
      showNotification(`✓ Notice dispatched to ${warnGrade} · ${warnSection}.`);
      setWarnMsg('');
    } catch (err: any) {
      showNotification(err?.message || 'Could not dispatch notice.');
    } finally {
      setSendingNotice(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Scope Indicator */}
      <div className="bento-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>
            Scoped Authorization:{' '}
            <strong className="text-white">{authorizedGrades.join(', ')}</strong>
            {' · '}
            <strong className="text-slate-200">{authorizedSections.join(', ')}</strong>
          </span>
        </div>
        <span className="text-[11px] font-medium text-slate-400">Coordinator Operations</span>
      </div>

      {/* 1. House Analytics & Point Control */}
      <div className="bento-card p-5 sm:p-6 rounded-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VeylentraIcon name="trophy" size="md" />
            <div>
              <h4 className="font-bold text-white text-base sm:text-lg font-display">
                House Standings &amp; Merit Adjustments
              </h4>
              <p className="text-xs text-slate-400">
                Aggregated from student XP records plus verified coordinator merit awards
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {houses.map(h => (
            <div key={h.id} className="p-4 rounded-xl bg-slate-950/75 border border-white/10 text-left">
              <div className="text-xs font-semibold text-slate-400 mb-1">{h.id} House</div>
              <div className="text-2xl font-bold text-white tabular-nums">{h.points}</div>
              <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                {h.participation} member{h.participation === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAwardPoints} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <select
            value={targetHouse}
            onChange={e => setTargetHouse(e.target.value as HouseType)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="Ruby">Ruby House</option>
            <option value="Emerald">Emerald House</option>
            <option value="Sapphire">Sapphire House</option>
            <option value="Topaz">Topaz House</option>
          </select>

          <input
            type="number"
            min={-50}
            max={100}
            value={pointsInput}
            onChange={e => setPointsInput(Number(e.target.value))}
            placeholder="Points (+/-)"
            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white tabular-nums"
          />

          <input
            type="text"
            value={reasonInput}
            onChange={e => setReasonInput(e.target.value)}
            placeholder="Merit justification..."
            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
          />

          <button
            type="submit"
            disabled={savingPoints}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Award className="w-3.5 h-3.5" />
            <span>{savingPoints ? 'Recording...' : 'Record Merit'}</span>
          </button>
        </form>
      </div>

      {/* 2. Targeted Grade & Section Notice */}
      <div className="bento-card p-5 sm:p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-white text-base sm:text-lg font-display">
              Targeted Cohort Advisory
            </h4>
            <p className="text-xs text-slate-400">
              Publish an academic circular or attendance reminder strictly to an authorized grade &amp; section
            </p>
          </div>
        </div>

        <form onSubmit={handleSendSectionNotice} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Authorized Grade</label>
              <select
                value={warnGrade}
                onChange={e => setWarnGrade(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                {authorizedGrades.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Section</label>
              <select
                value={warnSection}
                onChange={e => setWarnSection(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                {availableSections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={warnMsg}
            onChange={e => setWarnMsg(e.target.value)}
            rows={3}
            placeholder="Write a clear advisory, timetable update, or attendance reminder for this cohort..."
            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sendingNotice || !warnMsg.trim()}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingNotice ? 'Sending...' : 'Send Cohort Notice'}</span>
            </button>
          </div>
        </form>

        {recentActions.length > 0 && (
          <div className="pt-3 border-t border-white/10 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 block">Session Audit Trail</span>
            {recentActions.map(act => (
              <div key={act.id} className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {act.summary}
                </span>
                <span className="text-[11px] font-mono text-slate-500">{act.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
