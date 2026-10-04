const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/if \(auth\.currentUser\?\.uid && !isDemoMode\) \{/g, 'if (currentUser?.uid) {');
code = code.replace(/userId: auth\.currentUser\.uid/g, 'userId: currentUser?.uid || ""');

fs.writeFileSync('src/App.tsx', code);
