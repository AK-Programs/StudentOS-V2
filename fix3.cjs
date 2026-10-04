const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "const lines = part.split('\\n');');\n",
  "const lines = part.split('\\n');\n"
);
// Are there any other split('\\n')?
code = code.replace(
  /split\('([^']*)/g,
  function(match) {
    if(match.includes('\\n')) return match;
    if(match.includes(';')) return match; // skip ones we already fixed?
    return "split('\\n'";
  }
);

fs.writeFileSync('src/App.tsx', code);
