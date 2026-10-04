const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceManager.tsx', 'utf8');

// I will overwrite the file entirely for a cleaner approach.
console.log("File loaded.");
