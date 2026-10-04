const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const btnPattern = /\{activeRoomInfo\.type === 'channel' && \([\s\S]*?<\/span>\s*\)\}/;
const btnReplacement = `{activeRoomInfo.type === 'channel' && (
                            <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold mr-2">
                              📢 Broadcast Only
                            </span>
                          )}
                          {(activeRoomInfo as any).creatorId === currentUser?.uid && (
                            <button 
                              onClick={() => setShowGroupSettings(true)}
                              className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-md font-bold hover:bg-indigo-500/20 transition-all"
                            >
                              ⚙️ Group Settings
                            </button>
                          )}`;

content = content.replace(btnPattern, btnReplacement);
fs.writeFileSync('src/App.tsx', content);
console.log('Patched heading bar');
