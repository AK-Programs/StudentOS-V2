/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Classroom Panel Board Workspace
 * High-impact interactive smart display command center calibrated for
 * touchscreens, interactive flat panels, and classroom projectors.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2, Minimize2, Settings, X, Tv, Clock, Sparkles,
  BookOpen, Users, Bell, Calendar, PenTool, CheckCircle,
  HelpCircle, ChevronRight, RefreshCw, Volume2, Mic, ArrowLeft
} from 'lucide-react';
import { PanelBoardRegistrationData } from '../../lib/panelBoardDetector';
import { UserProfile } from '../../types';
import { Whiteboard2 } from '../Whiteboard2';
import { InAppDocumentViewer } from '../InAppDocumentViewer';

interface ClassroomPanelBoardProps {
  registration: PanelBoardRegistrationData | null;
  currentUser: UserProfile | null;
  effectiveRole?: string;
  onExit: () => void;
  onReassignRequest: () => void;
  showNotification?: (msg: string) => void;
}

export const ClassroomPanelBoard: React.FC<ClassroomPanelBoardProps> = ({
  registration,
  currentUser,
  effectiveRole = 'teacher',
  onExit,
  onReassignRequest,
  showNotification
}) => {
  const [activeTool, setActiveTool] = useState<'whiteboard' | 'broadcasts' | 'timetable' | 'attendance' | 'ai_assistant'>('whiteboard');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState<boolean>(false);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Fetch classroom announcements for this grade and section
  useEffect(() => {
    async function fetchClassBroadcasts() {
      setLoadingBroadcasts(true);
      try {
        const res = await fetch('/api/search/resources?type=notice&limit=10');
        if (res.ok) {
          const data = await res.json();
          if (data.results) {
            setBroadcasts(data.results);
          }
        }
      } catch (_) {
        // Fallback default announcements
        setBroadcasts([
          {
            id: 'n1',
            title: 'Welcome to Smart Panel Mode',
            content: `Registered to ${registration?.class_id || 'Class'} (${registration?.section_id || 'Section'}). Live school announcements and whiteboard sync active.`,
            createdAt: new Date().toISOString()
          }
        ]);
      } finally {
        setLoadingBroadcasts(false);
      }
    }
    fetchClassBroadcasts();
  }, [registration?.class_id, registration?.section_id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const isStaff = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  return (
    <div className="fixed inset-0 bg-slate-950 text-white z-[9990] flex flex-col font-sans select-none overflow-hidden">
      
      {/* Smart Panel Top Bar */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-white/10 flex items-center justify-between shrink-0 z-20">
        
        {/* Left: Branding & Registered Classroom */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white shrink-0 shadow-md">
            <Tv className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black truncate tracking-tight text-white">
                {registration?.display_name || 'Classroom Panel Board'}
              </h2>
              {registration && (
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  {registration.class_id} · {registration.section_id}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {registration ? 'Registered Classroom Display' : 'Guest Display Session'}
            </p>
          </div>
        </div>

        {/* Center: Live Clock & Quick Navigation */}
        <div className="hidden md:flex items-center gap-4 bg-slate-950 px-4 py-1.5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{currentTime}</span>
          </div>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-[11px] text-slate-400">{currentDate}</span>
        </div>

        {/* Right: Controls (Tool switcher, Fullscreen, Reassign, Exit) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Tool switch buttons */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTool('whiteboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTool === 'whiteboard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <PenTool className="w-3.5 h-3.5" /> Whiteboard
            </button>
            <button
              onClick={() => setActiveTool('broadcasts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTool === 'broadcasts' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Bell className="w-3.5 h-3.5" /> Broadcasts
            </button>
            <button
              onClick={() => setActiveTool('timetable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTool === 'timetable' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar className="w-3.5 h-3.5" /> Timetable
            </button>
          </div>

          {/* Reassign / Settings for staff */}
          {isStaff && (
            <button
              onClick={onReassignRequest}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 transition-all"
              title="Edit Panel Classroom Assignment"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Exit Panel Mode */}
          <button
            onClick={onExit}
            className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Exit Panel Board Mode"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </header>

      {/* Main Panel Body */}
      <main className="flex-1 relative overflow-hidden bg-slate-950 flex flex-col">
        {activeTool === 'whiteboard' && (
          <div className="w-full h-full relative">
            <Whiteboard2 onClose={onExit} currentUser={currentUser} />
          </div>
        )}

        {activeTool === 'broadcasts' && (
          <div className="p-6 sm:p-10 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <Bell className="w-6 h-6 text-indigo-400" /> Classroom Broadcast Feed
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Targeted updates for {registration?.class_id || 'Class'} ({registration?.section_id || 'Section'})
                </p>
              </div>
              <button
                onClick={() => setActiveTool('whiteboard')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <PenTool className="w-4 h-4" /> Return to Board
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {broadcasts.map((b, idx) => (
                <div key={b.id || idx} className="bg-slate-900 border border-white/10 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      Announcement
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(b.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{b.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{b.content || b.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTool === 'timetable' && (
          <div className="p-6 sm:p-10 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-emerald-400" /> Class Daily Schedule
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Master period timetable for {registration?.class_id || 'Class'} ({registration?.section_id || 'Section'})
                </p>
              </div>
              <button
                onClick={() => setActiveTool('whiteboard')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <PenTool className="w-4 h-4" /> Return to Board
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { period: 'Period 1', time: '08:30 - 09:20', subject: 'Mathematics', teacher: 'Dr. Srinivasan', room: 'Room 8' },
                { period: 'Period 2', time: '09:25 - 10:15', subject: 'Physics', teacher: 'Mrs. Davis', room: 'Physics Lab' },
                { period: 'Period 3', time: '10:30 - 11:20', subject: 'English Lit', teacher: 'Mr. Richardson', room: 'Room 8' },
                { period: 'Period 4', time: '11:25 - 12:15', subject: 'Computer Science', teacher: 'Mr. Kashyap', room: 'Tech Lab 1' },
                { period: 'Period 5', time: '13:00 - 13:50', subject: 'Chemistry', teacher: 'Dr. Henderson', room: 'Chemistry Lab' },
                { period: 'Period 6', time: '13:55 - 14:45', subject: 'History', teacher: 'Ms. Miller', room: 'Room 8' }
              ].map((slot, i) => (
                <div key={i} className="bg-slate-900 border border-white/10 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-indigo-400 font-bold">
                    <span>{slot.period}</span>
                    <span className="font-mono text-slate-400 text-[10px]">{slot.time}</span>
                  </div>
                  <h4 className="text-base font-bold text-white">{slot.subject}</h4>
                  <p className="text-xs text-slate-400">{slot.teacher} · {slot.room}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

    </div>
  );
};
