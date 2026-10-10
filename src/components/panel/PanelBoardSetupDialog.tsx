/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * First-Time Classroom Panel Board Setup Dialog
 * Guides authorized staff through registering an interactive display
 * to a verified class and section with server-authoritative Supabase storage.
 */

import React, { useState, useEffect } from 'react';
import {
  Monitor, Tv, School, Users, Check, AlertCircle,
  Loader2, X, Sparkles, ChevronRight, Info
} from 'lucide-react';
import {
  detectPanelBoardCapabilities,
  PanelDetectionResult,
  storePanelRegistrationLocally,
  PanelBoardRegistrationData
} from '../../lib/panelBoardDetector';
import { UserProfile } from '../../types';

interface PanelBoardSetupDialogProps {
  currentUser: UserProfile | null;
  effectiveRole?: string;
  onSuccess: (registration: PanelBoardRegistrationData) => void;
  onContinueGuest: () => void;
  onCancel: () => void;
}

export const PanelBoardSetupDialog: React.FC<PanelBoardSetupDialogProps> = ({
  currentUser,
  effectiveRole = 'student',
  onSuccess,
  onContinueGuest,
  onCancel
}) => {
  const [detection, setDetection] = useState<PanelDetectionResult | null>(null);
  
  // Real database metadata loaded from backend
  const [loadingMeta, setLoadingMeta] = useState<boolean>(true);
  const [grades, setGrades] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [schoolId, setSchoolId] = useState<string>('default_school');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  
  // Submission & Validation State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isStaffOrAdmin = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  // Run hardware capability detection
  useEffect(() => {
    const result = detectPanelBoardCapabilities();
    setDetection(result);
  }, []);

  // Fetch real classroom metadata from backend (Supabase)
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const res = await fetch('/api/panel-board/metadata');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setGrades(data.grades || []);
            setSections(data.sections || []);
            setSchools(data.schools || []);

            // Set initial defaults from currentUser or first available real option
            const userGrade = currentUser?.grade && data.grades.includes(currentUser.grade)
              ? currentUser.grade
              : data.grades[0] || 'Grade 10';
            const userSection = currentUser?.section && data.sections.includes(currentUser.section)
              ? currentUser.section
              : data.sections[0] || 'Astra';

            setSelectedGrade(userGrade);
            setSelectedSection(userSection);
            setSchoolId((currentUser as any)?.school_id || (currentUser as any)?.schoolId || data.schools?.[0]?.id || 'default_school');
            setDisplayName(`${userGrade} (${userSection}) Smart Panel`);
          }
        }
      } catch (err) {
        console.warn('Failed to load classroom metadata:', err);
      } finally {
        if (isMounted) setLoadingMeta(false);
      }
    }
    loadMeta();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Update default display name when grade or section changes if user hasn't heavily customized it
  const handleGradeChange = (newGrade: string) => {
    setSelectedGrade(newGrade);
    if (!displayName || displayName.includes('Smart Panel')) {
      setDisplayName(`${newGrade} (${selectedSection || 'Section'}) Smart Panel`);
    }
  };

  const handleSectionChange = (newSec: string) => {
    setSelectedSection(newSec);
    if (!displayName || displayName.includes('Smart Panel')) {
      setDisplayName(`${selectedGrade || 'Class'} (${newSec}) Smart Panel`);
    }
  };

  // Submit registration to authoritative backend
  const handleSaveAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedGrade || !selectedSection) {
      setErrorMessage('Please select both a Class/Grade and a Section.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/panel-board/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          class_id: selectedGrade,
          section_id: selectedSection,
          display_name: displayName.trim() || `${selectedGrade} Smart Display`,
          registered_by: currentUser?.uid || currentUser?.email || 'staff',
          device_metadata: detection ? {
            screenWidth: detection.screenWidth,
            screenHeight: detection.screenHeight,
            touchPoints: detection.touchPoints,
            isInteractiveTouch: detection.isLikelyPanelBoard,
            userAgent: navigator.userAgent
          } : undefined
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.registration) {
        throw new Error(result.error || 'Server could not record panel registration in Supabase.');
      }

      // Supabase write confirmed! Store locally for future visits
      storePanelRegistrationLocally(result.registration);
      onSuccess(result.registration);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setErrorMessage(err.message || 'Network error occurred while saving registration. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden relative my-auto">
        
        {/* Header with Title and Dismiss */}
        <div className="p-6 sm:p-7 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Set up this classroom Panel Board
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Register this display to a class and section so authorized school staff can send relevant announcements and broadcasts to the correct classroom.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors shrink-0"
            title="Cancel / Exit"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Detection Insight */}
        {detection && (
          <div className="px-6 sm:px-7 pt-4">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <Monitor className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold truncate">{detection.displaySummary}</span>
              </div>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md ${detection.isLikelyPanelBoard ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                {detection.isLikelyPanelBoard ? 'Touch Ready' : 'Standard'}
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 sm:mx-7 mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSaveAndContinue} className="p-6 sm:p-7 space-y-4 text-xs">
          
          {/* School Field */}
          <div>
            <label className="block font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-indigo-400" /> Authorized School
            </label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              disabled={loadingMeta || schools.length <= 1}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-70"
            >
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              {schools.length === 0 && (
                <option value="default_school">Oakridge International Academy</option>
              )}
            </select>
          </div>

          {/* Class / Grade & Section Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Class / Grade <span className="text-rose-400">*</span>
              </label>
              {loadingMeta ? (
                <div className="h-10 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-center text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Loading grades...
                </div>
              ) : (
                <select
                  value={selectedGrade}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {grades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Section <span className="text-rose-400">*</span>
              </label>
              {loadingMeta ? (
                <div className="h-10 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-center text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Loading sections...
                </div>
              ) : (
                <select
                  value={selectedSection}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {sections.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Optional Panel Display Name */}
          <div>
            <label className="block font-bold text-slate-300 mb-1.5">
              Panel Display Name <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Room 8 Smart Panel or Science Lab 2"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Registration Notice */}
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Once registered, this panel will remember its classroom connection and receive announcements and timetable feeds for {selectedGrade} ({selectedSection}).
            </p>
          </div>

          {/* Actions Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-white rounded-xl text-xs font-semibold hover:bg-white/5 transition-colors order-3 sm:order-1"
            >
              Cancel / Exit
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
              {isStaffOrAdmin && (
                <button
                  type="button"
                  onClick={onContinueGuest}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Continue Without Registering
                </button>
              )}

              <button
                type="submit"
                disabled={submitting || loadingMeta || !selectedGrade || !selectedSection}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving to Supabase...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Save and Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
