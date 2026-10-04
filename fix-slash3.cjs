const fs = require('fs');
let code = fs.readFileSync('src/components/TeacherStudentList.tsx', 'utf8');

const targetStr = `             className={\`p-4 rounded-2xl border cursor-pointer transition-all \${selectedGrade === grade ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 border-white/5 hover:border-indigo-500/30'}\`}`;
const replaceStr = "             className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedGrade === grade ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 border-white/5 hover:border-indigo-500/30'}`}";

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/TeacherStudentList.tsx', code);
