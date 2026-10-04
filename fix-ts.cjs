const fs = require('fs');
let code = fs.readFileSync('src/lib/supabaseChat.ts', 'utf8');

code = code.replace(/const locals = getLocalAiBuddyChats\(userId\);/g, (match, offset) => {
  if (offset > 4000) return 'const locals = getLocalMessages();';
  return match;
});

fs.writeFileSync('src/lib/supabaseChat.ts', code);
