const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(/attachedFile\?: \{ name: string; content: string; size: number; type: string \} \| null;/g, 'attachedFile?: { name: string; content: string; size: number; type: string } | null;\n  attachedFiles?: { name: string; content: string; size: number; type: string }[];');

fs.writeFileSync('src/types.ts', code);
