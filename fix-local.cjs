const fs = require('fs');

function processFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/return getLocal[A-Za-z]+\([^)]*\);/g, 'return [];');
  content = content.replace(/return getLocal[A-Za-z]+\(\);/g, 'return [];');
  content = content.replace(/getLocal[A-Za-z]+\(\)/g, '[]');
  fs.writeFileSync(path, content);
}
processFile('src/lib/supabaseChat.ts');
processFile('src/lib/supabaseResources.ts');
processFile('src/lib/supabaseNotes.ts');
processFile('src/lib/supabaseHomework.ts');
console.log('Fixed missed local storage functions');
