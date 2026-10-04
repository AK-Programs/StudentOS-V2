const fs = require('fs');
let code = fs.readFileSync('src/lib/supabaseChat.ts', 'utf8');

code = code.replace(/const locals = getLocalMessages\(\);\n      const merged = \[\.\.\.locals\];\n      for \(const t of mapped\) \{\n        if \(\!merged\.find\(m => m\.id === t\.id\)\) merged\.push\(t\);\n      \}\n      return merged\.sort\(\(a, b\) => b\.createdAt - a\.createdAt\);/g, 'const locals = getLocalAiBuddyChats(userId);\n      const merged = [...locals];\n      for (const t of mapped) {\n        if (!merged.find(m => m.id === t.id)) merged.push(t);\n      }\n      return merged.sort((a, b) => b.createdAt - a.createdAt);');

fs.writeFileSync('src/lib/supabaseChat.ts', code);
