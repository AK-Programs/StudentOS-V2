const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the split string literal
code = code.replace(
  /const lines = part\.split\('([^']*)/g,
  "const lines = part.split('\\n');"
);

fs.writeFileSync('src/App.tsx', code);
