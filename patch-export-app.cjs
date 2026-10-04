const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('export const app = express();')) {
  content = content.replace(
    'const app = express();',
    'export const app = express();'
  );
}

fs.writeFileSync('server.ts', content);
console.log('App exported');
