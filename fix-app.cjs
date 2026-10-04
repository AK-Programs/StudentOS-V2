const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/\{\(false\) \{\(DEV_MODE \|\| isSuperAdmin\) \&\& currentUser \&\& \(\{\(DEV_MODE \|\| isSuperAdmin\) \&\& currentUser \&\& \( \(/g, '{false && (');
content = content.replace(/\{\(false\) \&\& \(/g, '{false && (');

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed App.tsx syntax');
