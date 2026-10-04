const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "content: '# Untitled Note\n\nWrite your thoughts using **Markdown** formatting. Click on the reader view tab to preview!\n\n## Core Concepts\n\n- Concept 1\n- Concept 2',",
  "content: `# Untitled Note\\n\\nWrite your thoughts using **Markdown** formatting. Click on the reader view tab to preview!\\n\\n## Core Concepts\\n\\n- Concept 1\\n- Concept 2`,"
);

fs.writeFileSync('src/App.tsx', code);
