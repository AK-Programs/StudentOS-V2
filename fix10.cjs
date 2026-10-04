const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /\.join\('([^']*)/g,
  function(match) {
    if (match.includes('\\n')) return match;
    if (match.includes(';')) return match;
    return ".join('\\n\\n'";
  }
);

fs.writeFileSync('src/App.tsx', code);
