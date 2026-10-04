const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');
content = content.replace(
  /export interface ChatRoom \{\s*id: string;\s*name: string;\s*type: 'group' \| 'friend' \| 'channel';\s*icon: string;\s*description: string;\s*code\?: string;\s*\}/,
  `export interface ChatRoom {
  id: string;
  name: string;
  type: 'group' | 'friend' | 'channel';
  icon: string;
  description: string;
  code?: string;
  creatorId?: string;
  members?: string[];
  moderators?: string[];
}`
);

fs.writeFileSync('src/types.ts', content);
console.log('Patched ChatRoom type');
