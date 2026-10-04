const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /\.replace\(\/\n\/g/g,
  ".replace(/\\n/g"
);

fs.writeFileSync('src/App.tsx', code);
