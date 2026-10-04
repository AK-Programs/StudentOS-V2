const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const \[newRoomName, setNewRoomName\] = useState<string>\(''\);/,
  `const [newRoomName, setNewRoomName] = useState<string>('');
  const [showGroupSettings, setShowGroupSettings] = useState<boolean>(false);`
);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx with group states');
