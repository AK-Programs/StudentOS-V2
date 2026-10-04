const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the regex
code = code.replace(
  /const match = part.match\(\/```\(\\w\*\)\n\(\[\\s\\S\]\*\?\)```\/\);/g,
  "const match = part.match(/```(\\w*)\\n([\\s\\S]*?)```/);"
);

fs.writeFileSync('src/App.tsx', code);
