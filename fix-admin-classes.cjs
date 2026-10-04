const fs = require('fs');
let code = fs.readFileSync('src/components/AdminCenter.tsx', 'utf8');

const target = `            {editingUser.role === 'teacher' && (
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">Subjects (Comma separated)</label>`;

const replacement = `            {editingUser.role === 'teacher' && (
              <>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Assigned Grades (Comma separated)</label>
                  <input type="text" value={(editingUser.assignedGrades || []).join(', ')} onChange={e => setEditingUser({...editingUser, assignedGrades: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. Grade 9, Grade 10" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Assigned Sections (Comma separated)</label>
                  <input type="text" value={(editingUser.assignedSections || []).join(', ')} onChange={e => setEditingUser({...editingUser, assignedSections: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. Astra, Solara" />
                </div>
              </>
            )}
            {editingUser.role === 'teacher' && (
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">Subjects (Comma separated)</label>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/AdminCenter.tsx', code);
console.log("Added assignedGrades to AdminCenter");
