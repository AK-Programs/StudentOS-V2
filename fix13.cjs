const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] && lines[i].includes("handleToolbarInject('") && !lines[i].includes("')")) {
    // This line starts a string that wasn't closed.
    // Collect until we find "')"
    let j = i + 1;
    let block = [lines[i]];
    while (j < lines.length && !lines[j].includes("')")) {
      block.push(lines[j]);
      j++;
    }
    if (j < lines.length) {
      block.push(lines[j]);
      
      const combined = block.join('\\n');
      lines[i] = combined;
      // remove the next j - i lines
      lines.splice(i+1, j - i);
    }
  }
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
