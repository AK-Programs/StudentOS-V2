const fs = require('fs');
let code = fs.readFileSync('src/components/SubstituteHub.tsx', 'utf8');

// Add activeTab state
code = code.replace(
  'const [formOpen, setFormOpen] = useState(false);',
  `const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assignments' | 'emergencies' | 'swaps'>('assignments');
  const [swaps, setSwaps] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  
  useEffect(() => {
    try {
      const storedSwaps = localStorage.getItem('s_os_lecture_swaps');
      if (storedSwaps) setSwaps(JSON.parse(storedSwaps));
      const storedEmerg = localStorage.getItem('s_os_emergencies');
      if (storedEmerg) setEmergencies(JSON.parse(storedEmerg));
    } catch(e){}
  }, []);
  
  const saveSwaps = (list: any[]) => { setSwaps(list); localStorage.setItem('s_os_lecture_swaps', JSON.stringify(list)); };
  const saveEmergencies = (list: any[]) => { setEmergencies(list); localStorage.setItem('s_os_emergencies', JSON.stringify(list)); };
`
);

// Add Tab navigation UI
const tabCode = `
      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-0 mb-4 pt-4">
        <button 
          onClick={() => setActiveTab('assignments')}
          className={\`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all \${activeTab === 'assignments' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5 rounded-t-xl' : 'text-slate-500 hover:text-slate-300'}\`}
        >
          Daily Assignments
        </button>
        <button 
          onClick={() => setActiveTab('emergencies')}
          className={\`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all \${activeTab === 'emergencies' ? 'text-rose-400 border-b-2 border-rose-400 bg-rose-500/5 rounded-t-xl' : 'text-slate-500 hover:text-slate-300'}\`}
        >
          Emergency Leave
        </button>
        <button 
          onClick={() => setActiveTab('swaps')}
          className={\`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all \${activeTab === 'swaps' ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-500/5 rounded-t-xl' : 'text-slate-500 hover:text-slate-300'}\`}
        >
          Lecture Swaps
        </button>
      </div>
      
      {activeTab === 'assignments' && (
`;

code = code.replace(
  '{/* Header Panel */}',
  '{/* Header Panel */}'
);

code = code.replace(
  '      {/* My Duty Notice for Teachers */}',
  tabCode + '\n      {/* My Duty Notice for Teachers */}'
);

// Close the assignments tab content and add the other tabs
const otherTabs = `
      )} {/* end assignments tab */}

      {activeTab === 'emergencies' && (
        <div className="bg-slate-900/60 rounded-3xl border border-white/5 p-6 md:p-8 relative overflow-hidden space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Emergency Requests
            </h3>
            {['teacher', 'coordinator'].includes(effectiveRole) && (
              <button 
                onClick={() => {
                  const reason = prompt('Enter reason for emergency leave:');
                  if (reason) {
                    const newReq = { id: Date.now(), teacher: currentUser?.name || 'Unknown', reason, date: new Date().toISOString().split('T')[0], status: 'pending' };
                    saveEmergencies([newReq, ...emergencies]);
                    showNotification('Emergency leave request submitted.');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500 hover:text-white transition-all"
              >
                + Request Emergency Leave
              </button>
            )}
          </div>
          {emergencies.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No emergency requests active.</p>
          ) : (
            <div className="grid gap-3">
              {emergencies.map(em => (
                <div key={em.id} className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white">{em.teacher}</h4>
                    <p className="text-xs text-slate-400">Reason: {em.reason}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{em.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={\`text-[10px] px-2 py-1 rounded uppercase font-bold \${em.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : em.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}\`}>
                      {em.status}
                    </span>
                    {canManage && em.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => { const u = emergencies.map(x => x.id === em.id ? {...x, status: 'approved'} : x); saveEmergencies(u); showNotification('Approved emergency leave'); }} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { const u = emergencies.map(x => x.id === em.id ? {...x, status: 'denied'} : x); saveEmergencies(u); showNotification('Denied emergency leave'); }} className="text-rose-400 hover:text-rose-300"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'swaps' && (
        <div className="bg-slate-900/60 rounded-3xl border border-white/5 p-6 md:p-8 relative overflow-hidden space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-teal-500" />
              Lecture Swaps
            </h3>
            {['teacher'].includes(effectiveRole) && (
              <button 
                onClick={() => {
                  const target = prompt('Enter the name of the teacher you want to swap with:');
                  if (target) {
                    const newSwap = { id: Date.now(), requester: currentUser?.name || 'Unknown', target, date: new Date().toISOString().split('T')[0], status: 'pending' };
                    saveSwaps([newSwap, ...swaps]);
                    showNotification('Lecture swap request submitted.');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-bold hover:bg-teal-500 hover:text-white transition-all"
              >
                + Request Swap
              </button>
            )}
          </div>
          {swaps.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No active lecture swaps.</p>
          ) : (
            <div className="grid gap-3">
              {swaps.map(sw => (
                <div key={sw.id} className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white">{sw.requester} ↔ {sw.target}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{sw.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={\`text-[10px] px-2 py-1 rounded uppercase font-bold \${sw.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : sw.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}\`}>
                      {sw.status}
                    </span>
                    {(canManage || currentUser?.name === sw.target) && sw.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => { const u = swaps.map(x => x.id === sw.id ? {...x, status: 'approved'} : x); saveSwaps(u); showNotification('Approved lecture swap'); }} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { const u = swaps.map(x => x.id === sw.id ? {...x, status: 'denied'} : x); saveSwaps(u); showNotification('Denied lecture swap'); }} className="text-rose-400 hover:text-rose-300"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
`;

code = code.replace(
  '    </div>\n  );\n};',
  otherTabs + '\n    </div>\n  );\n};'
);

// We also need to add X icon from lucide-react if not present
if (!code.includes(', X }')) {
  code = code.replace('} from \'lucide-react\'', ', X } from \'lucide-react\'');
}

fs.writeFileSync('src/components/SubstituteHub.tsx', code);
