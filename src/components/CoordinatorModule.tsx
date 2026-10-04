import React, { useState, useEffect } from 'react';
import { HouseAnalytics, HouseType, UserProfile, SectionType } from '../types';

interface WarningMessage {
  id: string;
  grade: string;
  section: string;
  message: string;
  sentBy: string;
  timestamp: any;
}

export default function CoordinatorModule({ currentUser, showNotification }: { currentUser: UserProfile; showNotification: (msg: string) => void }) {
  const [houses, setHouses] = useState<HouseAnalytics[]>([]);
  const [pointsInput, setPointsInput] = useState<number>(10);
  const [targetHouse, setTargetHouse] = useState<HouseType>('Ruby');
  const [reasonInput, setReasonInput] = useState<string>('Excellence in Cultural Festival');
  
  const [warnGrade, setWarnGrade] = useState<string>('Grade 10');
  const [warnSection, setWarnSection] = useState<SectionType>('Solara');
  const [warnMsg, setWarnMsg] = useState<string>('Discipline is required in the corridors during transitions.');

  useEffect(() => {
    // Migration in progress
    setHouses([
      { id: 'Ruby', points: 1450, materialsShared: 38, quizzesWon: 27, participation: 91 },
      { id: 'Emerald', points: 1580, materialsShared: 42, quizzesWon: 30, participation: 94 },
      { id: 'Sapphire', points: 1320, materialsShared: 29, quizzesWon: 22, participation: 87 },
      { id: 'Topaz', points: 1410, materialsShared: 35, quizzesWon: 25, participation: 89 }
    ]);
  }, []);

  const handleAwardPoints = async () => {
    console.warn("CoordinatorModule migration in progress, handleAwardPoints not implemented");
  };

  const handleSendWarning = async () => {
    console.warn("CoordinatorModule migration in progress, handleSendWarning not implemented");
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. House Analytics & Point Control */}
      <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🏆</span>
          <div>
            <h4 className="font-bold text-white text-lg font-display uppercase tracking-tight">House Point Management</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Coordinator Level Override</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {houses.map(h => (
            <div key={h.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <div className="text-[10px] uppercase font-black text-slate-500 mb-1">{h.id} Points</div>
              <div className="text-2xl font-black text-white">{h.points}</div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-950/60 rounded-2xl border border-indigo-500/10 space-y-4 mt-4">
            <div className="text-center text-slate-400 py-4 text-sm">Migration in progress...</div>
        </div>
      </div>

      {/* 2. Warning Control */}
      <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="font-bold text-white text-lg font-display uppercase tracking-tight">System Warnings & Alerts</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Targeted Classroom Notice</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/60 rounded-2xl border border-rose-500/10 space-y-4">
            <div className="text-center text-slate-400 py-4 text-sm">Migration in progress...</div>
        </div>
      </div>
    </div>
  );
}
