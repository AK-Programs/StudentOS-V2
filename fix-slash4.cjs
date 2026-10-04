const fs = require('fs');
let code = fs.readFileSync('src/components/TeacherStudentList.tsx', 'utf8');

code = code.replace(/className=\{\\`p-4/g, "className={`p-4");
code = code.replace(/all \\\$\{selectedGrade/g, "all ${selectedGrade");
code = code.replace(/30'\\}\\`\}/g, "30'}`}");

fs.writeFileSync('src/components/TeacherStudentList.tsx', code);
