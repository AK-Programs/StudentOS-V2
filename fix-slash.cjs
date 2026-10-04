const fs = require('fs');
let code = fs.readFileSync('src/components/TeacherStudentList.tsx', 'utf8');

code = code.replace("rMap[r.student_id] += \\`\\n- \\${r.remark} (\\${r.author_name})\\`;", "rMap[r.student_id] += `\\n- ${r.remark} (${r.author_name})`;");
fs.writeFileSync('src/components/TeacherStudentList.tsx', code);
