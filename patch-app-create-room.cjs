const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const createRoomPattern = /const newRoom: ChatRoom = \{\s*id: roomId,\s*name: newRoomName\.trim\(\),\s*type: newRoomType,\s*icon: newRoomIcon,\s*description: newRoomDescription\.trim\(\) \|\| \`Study room created for peers\`,\s*code: Math\.random\(\)\.toString\(36\)\.substring\(2, 8\)\.toUpperCase\(\)\s*\};/;
const createRoomReplacement = `const newRoom: ChatRoom = {
      id: roomId,
      name: newRoomName.trim(),
      type: newRoomType,
      icon: newRoomIcon,
      description: newRoomDescription.trim() || \`Study room created for peers\`,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      creatorId: currentUser?.uid || 'unknown',
      members: [currentUser?.uid || 'unknown'],
      moderators: [currentUser?.uid || 'unknown']
    };`;

content = content.replace(createRoomPattern, createRoomReplacement);
fs.writeFileSync('src/App.tsx', content);
console.log('Patched handleCreateRoom');
