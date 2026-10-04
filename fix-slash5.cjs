const fs = require('fs');
let code = fs.readFileSync('src/components/TeacherStudentList.tsx', 'utf8');

code = code.replace("30'}\\`}", "30'}`}");

fs.writeFileSync('src/components/TeacherStudentList.tsx', code);
