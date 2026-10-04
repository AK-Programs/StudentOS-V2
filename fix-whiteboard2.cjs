const fs = require('fs');
let code = fs.readFileSync('src/components/Whiteboard2.tsx', 'utf8');
code = code.replace("export function Whiteboard2({ onClose, initialPrompt }: { onClose?: () => void; initialPrompt?: string })", "export function Whiteboard2({ onClose, initialPrompt, currentUser }: { onClose?: () => void; initialPrompt?: string; currentUser?: any })");
fs.writeFileSync('src/components/Whiteboard2.tsx', code);
