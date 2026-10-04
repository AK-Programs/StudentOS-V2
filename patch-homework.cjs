const fs = require('fs');

let content = fs.readFileSync('src/lib/supabaseHomework.ts', 'utf8');

// Remove fallback block in get
content = content.replace(/\/\/ Fallback\s*try \{\s*const cached = localStorage.getItem\('s_os_homework_global'\);\s*if \(cached\) return JSON.parse\(cached\);\s*\} catch\(e\) \{\}/, '');

// Remove local save
content = content.replace(/\/\/ Local fallback save first\s*try \{\s*const cached = localStorage.getItem\('s_os_homework_global'\);[\s\S]*?localStorage.setItem\('s_os_homework_global', JSON.stringify\(list\)\);\s*\} catch\(e\) \{\}/, '');

// Remove local delete
content = content.replace(/\/\/ Local fallback delete first\s*try \{\s*const cached = localStorage.getItem\('s_os_homework_global'\);[\s\S]*?localStorage.setItem\('s_os_homework_global', JSON.stringify\(list\)\);\s*\}\s*\} catch\(e\) \{\}/, '');

fs.writeFileSync('src/lib/supabaseHomework.ts', content);
console.log('Stripped local storage from homework');
