const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/auth\.currentUser\?\.uid/g, 'currentUser?.uid');
code = code.replace(/auth\.currentUser\.uid/g, 'currentUser?.uid || ""');

fs.writeFileSync('src/App.tsx', code);
