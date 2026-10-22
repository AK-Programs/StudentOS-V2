/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Enterprise Year-End Promotion Modal
 * Confirms candidate student counts, isolates historical academic records,
 * moves students to next academic tier, and triggers persistent audit logs.
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { 
  ACADEMIC_GRADES, 
  CLASS_SECTIONS, 
  getNextGrade, 
  getPromotionEligibleStudents, 
  executeClassPromotion, 
  PromotionResult 
} from '../lib/promotionService';
import { 
  GraduationCap, ArrowRight, AlertTriangle, CheckCircle2, 
  Users, Calendar, Shield, X, Sparkles, RefreshCw
} from 'lucide-react';

interface YearEndPromotionModalProps {
  currentUser: UserProfile;
  effectiveRole?: UserRole;
  onClose: () => void;
  onSuccess: (result: PromotionResult) => void;
}

export function YearEndPromotionModal({
  currentUser,
  effectiveRole,
  onClose,
  onSuccess
}: YearEndPromotionModalProps) {
  const [sourceGrade, setSourceGrade] = useState<string>('Grade 8');
  const [sourceSection, setSourceSection] = useState<string>('Astra');
  const [targetGrade, setTargetGrade] = useState<string>('Grade 9');
  const [targetSection, setTargetSection] = useState<string>('Astra');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');

  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidates, setCandidates] = useState<UserProfile[]>([]);
  const [step, setStep] = useState<'configure' | 'confirm' | 'executing' | 'success'>('configure');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<PromotionResult | null>(null);

  // Update target grade whenever source grade changes
  useEffect(() => {
    setTargetGrade(getNextGrade(sourceGrade));
  }, [sourceGrade]);

  // Load eligible students whenever source grade or section changes
  useEffect(() => {
    loadEligibleStudents();
  }, [sourceGrade, sourceSection]);

  const loadEligibleStudents = async () => {
    setLoadingCandidates(true);
    setErrorMsg(null);
    try {
      const list = await getPromotionEligibleStudents(sourceGrade, sourceSection);
      setCandidates(list);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to query student roster.');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleProceedToConfirm = () => {
    if (candidates.length === 0) {
      setErrorMsg(`No active students found in ${sourceGrade} - Section ${sourceSection}. Please select a class with active students.`);
      return;
    }
    setErrorMsg(null);
    setStep('confirm');
  };

  const handleExecutePromotion = async () => {
    setStep('executing');
    setErrorMsg(null);
    try {
      const result = await executeClassPromotion({
        sourceGrade,
        sourceSection,
        targetGrade,
        targetSection,
        academicYear,
        actor: currentUser,
        effectiveRole,
        studentIdsToPromote: candidates.map(c => c.uid || c.email)
      });

      if (!result.success) {
        setErrorMsg(result.message);
        setStep('configure');
        return;
      }

      setFinalResult(result);
      setStep('success');
      onSuccess(result);
    } catch (e: any) {
      setErrorMsg(e.message || 'Promotion execution failed.');
      setStep('configure');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-950 border border-emerald-500/30 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Institutional Class Transition
                </span>
              </div>
              <h3 className="text-xl font-black text-white mt-0.5">Year-End Class Promotion</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: CONFIGURE */}
        {step === 'configure' && (
          <div className="space-y-6">
            <p className="text-xs text-slate-300 leading-relaxed">
              Batch-transition an entire cohort to the next grade level. Historical attendance, marks, and report cards remain permanently readable in academic archives while student profiles are upgraded for the new session.
            </p>

            {/* Source & Target Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* SOURCE */}
              <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                  1. Current Source Cohort
                </span>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Current Grade</label>
                  <select
                    value={sourceGrade}
                    onChange={e => setSourceGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {ACADEMIC_GRADES.filter(g => !g.includes('Alumni')).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Current Section</label>
                  <select
                    value={sourceSection}
                    onChange={e => setSourceSection(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {CLASS_SECTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TARGET */}
              <div className="p-4 bg-slate-900/80 border border-emerald-500/20 rounded-2xl space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                  2. Destination Academic Class
                </span>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Promote To Grade</label>
                  <select
                    value={targetGrade}
                    onChange={e => setTargetGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {ACADEMIC_GRADES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Destination Section</label>
                  <select
                    value={targetSection}
                    onChange={e => setTargetSection(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {CLASS_SECTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Academic Session */}
            <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Academic Session</label>
                <span className="text-xs text-slate-500">Separates upcoming term datasets from archives.</span>
              </div>
              <input
                type="text"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                placeholder="2026-2027"
                className="w-36 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-mono text-center focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Candidate Roster Preview */}
            <div className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Active Students Detected: <span className="font-mono text-emerald-400 font-black">{candidates.length}</span>
                </span>
                <button
                  onClick={loadEligibleStudents}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingCandidates ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loadingCandidates ? (
                <div className="py-4 text-center text-xs text-slate-500">Checking class roster...</div>
              ) : candidates.length === 0 ? (
                <div className="py-4 text-center text-xs text-amber-400/80 bg-amber-500/5 rounded-xl border border-amber-500/10">
                  No active students enrolled in {sourceGrade} - Section {sourceSection}.
                </div>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                  {candidates.map((stu, i) => (
                    <div key={stu.uid || i} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-slate-200 font-bold">{stu.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{stu.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToConfirm}
                disabled={candidates.length === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <span>Review & Verify Promotion</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIRMATION DIALOG */}
        {step === 'confirm' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Confirm Institutional Class Promotion</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                You are about to promote <strong className="text-white">{candidates.length} active students</strong> from <strong className="text-amber-300">{sourceGrade} - {sourceSection}</strong> to <strong className="text-emerald-300">{targetGrade} - {targetSection}</strong> for Academic Session <strong className="text-white">{academicYear}</strong>.
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-white/10 rounded-2xl space-y-3">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Institutional Audit & Safety Guarantees:</h5>
              <ul className="text-xs text-slate-300 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Prior academic year attendance, test marks, and report cards are preserved in the permanent archive.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Each student profile will receive a verified promotion history timestamp.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>An unalterable enterprise audit log will be published recording Principal / Admin authorization.</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setStep('configure')}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Back to Settings
              </button>
              <button
                onClick={handleExecutePromotion}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Confirm & Promote {candidates.length} Students</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: EXECUTING */}
        {step === 'executing' && (
          <div className="py-12 text-center space-y-4 animate-fadeIn">
            <div className="w-12 h-12 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <h4 className="text-base font-black text-white">Promoting Students & Archiving Records...</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Updating student class metadata, generating promotion history stamps, and recording enterprise audit logs.
            </p>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'success' && finalResult && (
          <div className="py-8 text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border-2 border-emerald-500/30 shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-xl font-black text-white">Year-End Promotion Completed!</h4>
              <p className="text-xs text-emerald-400 mt-1 font-bold">
                {finalResult.promotedCount} students successfully moved to {finalResult.destinationClass}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-2">
                All records for Academic Session {finalResult.academicYear} have been segregated. An official audit log entry has been dispatched.
              </p>
            </div>

            <div className="pt-4 flex justify-center">
              <button
                onClick={onClose}
                className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
              >
                Done / Return to Admin Center
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
