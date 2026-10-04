const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/startServer\(\);/g, `
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer();
}
`);
fs.writeFileSync('server.ts', content);
console.log('Patched startServer call');
