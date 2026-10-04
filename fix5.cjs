const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

// The error is around line 1693. Let's look at lines 1690 to 1700.
for(let i=1690; i<1700; i++) {
  if(lines[i] && lines[i].includes('{ role: \'assistant\' as const, content: "Hey! 🚀 Welcome')) {
    lines[i] = lines[i].replace('content: "Hey!', 'content: `Hey!');
  }
  if(lines[i] && lines[i].includes('Just start asking a question!" }')) {
    lines[i] = lines[i].replace('Just start asking a question!" }', 'Just start asking a question!` }');
  }
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
