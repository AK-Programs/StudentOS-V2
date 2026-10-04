const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/Do not include markdown ```json wrappers./g, 'Do not include markdown json wrappers.');

fs.writeFileSync('server.ts', content);
