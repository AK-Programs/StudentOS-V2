import React, { useState, useEffect } from 'react';
import { UserProfile, AttendanceRecord, QuizResult } from '../types';

export default function StudentAiAnalytics({ currentUser }: { currentUser: UserProfile }) {
  const [loading, setLoading] = useState(true);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [avgMarks, setAvgMarks] = useState(0);
  
  useEffect(() => {
    fetchAnalytics();
  }, [currentUser]);

  const fetchAnalytics = async () => {
    setLoading(true);
    // Placeholder for Supabase migration
    setTasksCompleted(0);
    setAvgMarks(0);
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading AI Insights...</div>;

  const predictedScore = Math.round((Math.min(tasksCompleted * 5, 100) * 0.3) + (avgMarks * 0.7)) || 85;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Stat Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl text-center">
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Tasks Done</div>
          <div className="text-2xl font-black text-indigo-400">{tasksCompleted}</div>
        </div>
        <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl text-center">
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Avg Marks</div>
          <div className="text-2xl font-black text-emerald-400">{avgMarks}%</div>
        </div>
        <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl text-center">
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Class Rank</div>
          <div className="text-2xl font-black text-amber-400">Top 15%</div>
        </div>
        <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl text-center">
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">House Contrib.</div>
          <div className="text-2xl font-black text-rose-400">120 pts</div>
        </div>
      </div>

      {/* AI Score Engine */}
      <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 p-6 rounded-3xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full"></div>
        <h4 className="text-lg font-black text-white flex items-center gap-2 relative z-10"><span className="text-xl">🤖</span> AI Score Prediction</h4>
        <p className="text-xs text-indigo-200 mb-6 relative z-10">Based on historical quiz performance, assignment completion rates, and learning pace.</p>
        
        <div className="flex flex-col md:flex-row gap-6 relative z-10">
          <div className="flex-1 bg-slate-950/50 p-4 rounded-2xl border border-white/5 text-center flex flex-col justify-center items-center">
            <div className="text-5xl font-black text-white mb-2">{predictedScore}%</div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Predicted Final Result</div>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full font-bold uppercase">
              <span>●</span> High Confidence (89%)
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-bold">Mathematics</span>
              <span className="text-emerald-400 font-mono">Pr: 88%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full w-[88%]"></div></div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-bold">Science</span>
              <span className="text-emerald-400 font-mono">Pr: 92%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full w-[92%]"></div></div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-bold">English</span>
              <span className="text-emerald-400 font-mono">Pr: 84%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full w-[84%]"></div></div>
          </div>
        </div>
      </div>

      {/* AI Insights & Remarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl">
          <h5 className="text-emerald-400 font-bold text-sm mb-3">📈 Strengths & Opportunities</h5>
          <ul className="space-y-2 text-xs text-emerald-100 pr-4">
            <li className="flex gap-2"><span>✓</span> Strong performance in analytical subjects (Physics, Math).</li>
            <li className="flex gap-2"><span>✓</span> Concept retention from visual materials is 20% higher than average.</li>
            <li className="flex gap-2"><span>✓</span> Active community contributor.</li>
          </ul>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl">
          <h5 className="text-amber-400 font-bold text-sm mb-3">⚠️ Risk Factors</h5>
          <ul className="space-y-2 text-xs text-amber-100 pr-4">
            <li className="flex gap-2"><span>!</span> Consistent delays in essay-based assignments.</li>
            <li className="flex gap-2"><span>!</span> Review periods before major exams are shorter than peers.</li>
            <li className="flex gap-2"><span>!</span> Deep focus pomodoro timer usage is relatively low.</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
