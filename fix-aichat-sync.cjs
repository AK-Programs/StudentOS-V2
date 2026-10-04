const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /setAiThreads\(list as any\);/g,
  `const uniqueList = Array.from(new Map(list.map(t => [t.id, t])).values());
        setAiThreads(uniqueList as any);`
);

fs.writeFileSync('src/App.tsx', code);
