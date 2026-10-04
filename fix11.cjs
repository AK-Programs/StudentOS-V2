const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /\.join\('\\n\\n''\)/g,
  ".join('')"
);

code = code.replace(
  "        }).join('",
  "        }).join('\\n\\n');"
);

fs.writeFileSync('src/App.tsx', code);
