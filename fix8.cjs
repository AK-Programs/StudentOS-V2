const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

for(let i=2760; i<2775; i++) {
  if (lines[i] && lines[i].includes("content: '# Untitled Note")) {
    lines[i] = lines[i].replace("content: '# Untitled Note", "content: `# Untitled Note");
  }
  if (lines[i] && lines[i].includes("- Concept 2',")) {
    lines[i] = lines[i].replace("- Concept 2',", "- Concept 2`,");
  }
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
