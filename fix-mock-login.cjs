const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    } else if (role === 'teacher') {
      mockProfile.grade = 'Grade 10';
      mockProfile.section = 'Solara';
      mockProfile.house = 'Ruby';
      mockProfile.department = 'Science';
      mockProfile.subjects = ['Physics', 'Chemistry'];
      mockProfile.specialtySubject = 'Physics';
      mockProfile.assignedGrades = ['Grade 10', 'Grade 12'];
      mockProfile.assignedSections = ['Solara', 'Vega'];`;

const replace = `    } else if (role === 'teacher') {
      mockProfile.department = 'Science';
      mockProfile.subjects = ['Physics', 'Chemistry'];
      mockProfile.specialtySubject = 'Physics';
      mockProfile.assignedGrades = ['Grade 10', 'Grade 12'];
      mockProfile.assignedSections = ['Solara', 'Vega'];`;

code = code.replace(target, replace);
fs.writeFileSync('src/App.tsx', code);
