const fs = require('fs');

function processFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // Replace fallback returns with empty arrays or null
  content = content.replace(/return getLocal[A-Za-z]+\([^)]*\);/g, 'return [];');
  
  // Remove saveLocal and deleteLocal calls
  content = content.replace(/saveLocal[A-Za-z]+\([^)]*\);/g, '');
  content = content.replace(/deleteLocal[A-Za-z]+\([^)]*\);/g, '');
  
  // Remove the actual functions
  content = content.replace(/function getLocal[A-Za-z]+\([\s\S]*?\n\}/g, '');
  content = content.replace(/function saveLocal[A-Za-z]+\([\s\S]*?\n\}/g, '');
  content = content.replace(/function deleteLocal[A-Za-z]+\([\s\S]*?\n\}/g, '');
  
  // Remove merge with local storage logic if it exists
  content = content.replace(/\/\/ Merge with local storage[\s\S]*?return merged\.sort\((.*?)\);/g, 'return mapped.sort($1);');
  
  fs.writeFileSync(path, content);
}

processFile('src/lib/supabaseChat.ts');
processFile('src/lib/supabaseNotes.ts');
processFile('src/lib/supabaseHomework.ts');
processFile('src/lib/supabaseResources.ts');
console.log('Stripped local storage');
