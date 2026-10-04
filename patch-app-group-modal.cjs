const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const modalCode = `
      {/* Group Settings Modal */}
      {showGroupSettings && activeChatTargetId && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl animate-fadeIn">
            <div className="absolute top-4 right-4 flex gap-2">
               {(() => {
                 const room = chatRooms.find(r => r.id === activeChatTargetId);
                 if (room && room.creatorId === currentUser?.uid) {
                    return (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
                            // Call delete group logically (placeholder for DB delete)
                            setChatRooms(prev => prev.filter(r => r.id !== activeChatTargetId));
                            setActiveChatTargetId('group-all');
                            setShowGroupSettings(false);
                            showNotification('Group deleted successfully.');
                          }
                        }}
                        className="text-[10px] text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg border border-rose-500/20 font-bold uppercase transition-all"
                      >
                        Delete Group
                      </button>
                    );
                 }
                 return null;
               })()}
              <button
                onClick={() => setShowGroupSettings(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>
            
            <h2 className="text-xl font-black text-white mb-6">Group Settings</h2>
            
            {(() => {
              const room = chatRooms.find(r => r.id === activeChatTargetId);
              if (!room) return null;
              
              return (
                <div className="space-y-4">
                   <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Group Name</label>
                     <div className="flex gap-2">
                       <input 
                         type="text" 
                         defaultValue={room.name} 
                         id="edit-group-name"
                         className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" 
                       />
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Description</label>
                     <textarea 
                       defaultValue={room.description} 
                       id="edit-group-desc"
                       rows={2}
                       className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white resize-none" 
                     />
                   </div>
                   
                   <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Icon</label>
                     <input 
                       type="text" 
                       defaultValue={room.icon} 
                       id="edit-group-icon"
                       className="w-20 text-center bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-base text-white" 
                     />
                   </div>
                   
                   <div className="pt-2">
                     <button
                       onClick={() => {
                         const newName = (document.getElementById('edit-group-name') as HTMLInputElement).value;
                         const newDesc = (document.getElementById('edit-group-desc') as HTMLTextAreaElement).value;
                         const newIcon = (document.getElementById('edit-group-icon') as HTMLInputElement).value;
                         
                         const updatedRoom = { ...room, name: newName, description: newDesc, icon: newIcon };
                         setChatRooms(prev => prev.map(r => r.id === room.id ? updatedRoom : r));
                         // Assume saving to DB logic is implemented by syncing state here
                         setShowGroupSettings(false);
                         showNotification('Group settings updated!');
                       }}
                       className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all"
                     >
                       Save Changes
                     </button>
                   </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
`;

content = content.replace(/\{\s*\/\* DEV & SUPER ADMIN Role Switcher \*\/\s*\}/, modalCode + '\n\n      {/* DEV & SUPER ADMIN Role Switcher */}');
fs.writeFileSync('src/App.tsx', content);
console.log('Patched modal in App.tsx');
