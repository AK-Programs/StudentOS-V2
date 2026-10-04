const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  // If line ends with a string opener that wasn't closed
  if (lines[i].endsWith("'") && lines[i+1] && lines[i+1].startsWith("')")) {
    lines[i] = lines[i] + "\\n" + lines[i+1];
    lines.splice(i+1, 1);
    i--;
  }
}

// Just globally search for the handleToolbarInject broken lines
code = lines.join('\n');
code = code.replace(
  /handleToolbarInject\('([^']*)', '\n'\)/g,
  "handleToolbarInject('$1', '\\n')"
);

code = code.replace(
  /handleToolbarInject\('([^']*)',\n'\n'\)/g,
  "handleToolbarInject('$1', '\\n')"
);

fs.writeFileSync('src/App.tsx', code);
