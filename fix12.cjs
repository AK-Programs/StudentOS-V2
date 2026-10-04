const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "handleToolbarInject('\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n', '')",
  "handleToolbarInject('\\n| Header | Header |\\n|--------|--------|\\n| Cell   | Cell   |\\n', '')"
);
code = code.replace(
  "handleToolbarInject('\n```\ncode\n```\n', '')",
  "handleToolbarInject('\\n```\\ncode\\n```\\n', '')"
);

fs.writeFileSync('src/App.tsx', code);
