import React, { useState, useEffect } from 'react';
import { HouseAnalytics as HouseAnalyticsType } from '../types';

export default function HouseChampionship({ currentUser, effectiveRole, showNotification }: any) {
  const [houses, setHouses] = useState<any[]>([]);
  const [editingHouse, setEditingHouse] = useState<string | null>(null);
  
  // Custom states for editing leaders
  const [captainName, setCaptainName] = useState('');
  const [captainGrade, setCaptainGrade] = useState('');
  const [viceCaptainName, setViceCaptainName] = useState('');
  const [viceCaptainGrade, setViceCaptainGrade] = useState('');

  const canEdit = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  useEffect(() => {
    // Placeholder for Supabase migration
    setHouses([
      { id: 'Ruby', points: 1450, captainName: 'Aditya Sen', captainGrade: 'Grade 10', viceCaptainName: 'Chloe Lin', viceCaptainGrade: 'Grade 10' },
      { id: 'Emerald', points: 1580, captainName: 'Kiara Jha', captainGrade: 'Grade 10', viceCaptainName: 'Marcus Vance', viceCaptainGrade: 'Grade 10' },
      { id: 'Sapphire', points: 1320, captainName: 'Chloe Lin', captainGrade: 'Grade 10', viceCaptainName: 'Aditya Sen', viceCaptainGrade: 'Grade 10' },
      { id: 'Topaz', points: 1410, captainName: 'Marcus Vance', captainGrade: 'Grade 10', viceCaptainName: 'Kiara Jha', viceCaptainGrade: 'Grade 10' }
    ].sort((a,b) => b.points - a.points));
  }, [currentUser, effectiveRole]);

  const handleEditClick = (house: any) => {
    setEditingHouse(house.id);
    setCaptainName(house.captainName || '');
    setCaptainGrade(house.captainGrade || '');
    setViceCaptainName(house.viceCaptainName || '');
    setViceCaptainGrade(house.viceCaptainGrade || '');
  };

  const handleSaveLeaders = async (houseId: string) => {
    console.warn("HouseChampionship migration in progress, handleSaveLeaders not implemented");
  };

  return (
    <div className="smart-glass p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 max-w-6xl mx-auto animate-fadeIn w-full">
      <div className="space-y-1">
        <h3 className="text-xl sm:text-2xl font-black font-display text-white">House Championship Leaderboard</h3>
        <p className="text-xs text-slate-400">Live rankings and points based on attendance, assignments, and contributions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {houses.map((h, i) => (
          <div key={h.id} className={`p-5 rounded-3xl border w-full text-center relative overflow-hidden flex flex-col ${
             h.id === 'Ruby' ? 'border-red-500/30 bg-red-500/10' :
             h.id === 'Emerald' ? 'border-emerald-500/30 bg-emerald-500/10' :
             h.id === 'Sapphire' ? 'border-indigo-500/30 bg-indigo-500/10' :
             'border-amber-500/30 bg-amber-500/10'
          }`}>
             {i === 0 && <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl z-20 shadow-md">1st Place</div>}
             <div className={`text-4xl font-black font-display uppercase tracking-wider mb-2 ${
               h.id === 'Ruby' ? 'text-red-400' :
               h.id === 'Emerald' ? 'text-emerald-400' :
               h.id === 'Sapphire' ? 'text-indigo-400' :
               'text-amber-400'
             }`}>{h.id}</div>
             <div className="text-3xl font-mono font-bold text-white mb-6 bg-slate-950/40 inline-block px-4 py-2 rounded-2xl mx-auto border border-white/5 shadow-inner">
               {h.points || 0} <span className="text-[10px] text-slate-400 tracking-widest">PTS</span>
             </div>
             
             {/* House Leaders Section */}
             <div className="mb-4 bg-slate-950/60 p-3 rounded-2xl text-left border border-white/5 flex-grow">
               <h5 className="text-[10px] uppercase text-white/50 font-black tracking-widest mb-2 px-1 border-b border-white/5 pb-1">House Leaders</h5>
               
               {editingHouse === h.id ? (
                 <div className="space-y-2">
                   <div className="text-center text-slate-400 text-xs py-2">Migration in progress...</div>
                   <button onClick={() => setEditingHouse(null)} className="w-full bg-slate-700 text-white px-2 py-1 rounded text-[10px]">Cancel</button>
                 </div>
               ) : (
                 <div className="space-y-3">
                   <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                     <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center text-xs">👑</div>
                     <div>
                       <div className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">Captain</div>
                       <div className="text-xs font-bold text-white truncate max-w-[120px]">{h.captainName || 'Not Assigned'}</div>
                       {h.captainGrade && <div className="text-[9px] text-slate-400 truncate">{h.captainGrade}</div>}
                     </div>
                   </div>
                   <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                     <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-xs">⭐</div>
                     <div>
                       <div className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Vice Captain</div>
                       <div className="text-xs font-bold text-white truncate max-w-[120px]">{h.viceCaptainName || 'Not Assigned'}</div>
                       {h.viceCaptainGrade && <div className="text-[9px] text-slate-400 truncate">{h.viceCaptainGrade}</div>}
                     </div>
                   </div>
                 </div>
               )}
             </div>

             <div className="grid grid-cols-2 gap-2 text-left mt-auto">
               <div className="bg-slate-950/40 p-2 rounded-xl">
                 <div className="text-[8px] uppercase text-slate-400 font-bold tracking-widest mb-1">Materials</div>
                 <div className="text-sm font-black text-slate-200">{h.materialsShared || 0}</div>
               </div>
               <div className="bg-slate-950/40 p-2 rounded-xl">
                 <div className="text-[8px] uppercase text-slate-400 font-bold tracking-widest mb-1">Quizzes</div>
                 <div className="text-sm font-black text-slate-200">{h.quizzesWon || 0}</div>
               </div>
               <div className="bg-slate-950/40 p-2 rounded-xl col-span-2">
                 <div className="text-[8px] uppercase text-slate-400 font-bold tracking-widest mb-1">Participation Match</div>
                 <div className="text-sm font-black text-slate-200">{h.participation || 0}%</div>
               </div>
             </div>
          </div>
        ))}
      </div>
      
      <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-6 mt-4">
        <h4 className="text-sm font-bold text-white mb-2">How points are awarded:</h4>
        <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
          <li><strong>Attendance:</strong> +5 points for perfect weekly attendance.</li>
          <li><strong>Assignments:</strong> +10 points for completion before deadline.</li>
          <li><strong>Quizzes:</strong> +15 points for placing in the Top 3.</li>
          <li><strong>Material Sharing:</strong> +20 points when an uploaded material becomes Popular natively.</li>
        </ul>
      </div>
    </div>
  );
}
