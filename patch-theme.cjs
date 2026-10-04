const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove from Sidebar
const sidebarThemeRegex = /\{\/\* Theme Selector Widget \*\/\}[\s\S]*?(?=<button\s+onClick=\{handleLogout\})/m;
content = content.replace(sidebarThemeRegex, '');

// 2. Add to Profile tab
const profileEndRegex = /(<\/\>\s*\)\}\s*)(<\/div>\s*)\{\/\* Tab: Blogs \*\/}/;

const themeSettingsCode = `
                  <div className="mt-12 pt-8 border-t border-white/5">
                    <h4 className="text-sm font-bold font-display text-white mb-4">Application Settings</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-3">Visual Theme</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setThemeMode('light')}
                            className={\`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all \${themeMode === 'light' ? 'bg-white text-slate-900 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'}\`}
                          >
                            ☀️ Light
                          </button>
                          <button
                            type="button"
                            onClick={() => setThemeMode('dark')}
                            className={\`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all \${themeMode === 'dark' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'}\`}
                          >
                            🌙 Dark
                          </button>
                          <button
                            type="button"
                            onClick={() => setThemeMode('auto')}
                            className={\`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all \${themeMode === 'auto' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'}\`}
                          >
                            ⚙️ Auto
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
`;

content = content.replace(profileEndRegex, `$1${themeSettingsCode}$2{/* Tab: Blogs */}`);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched theme toggle');
