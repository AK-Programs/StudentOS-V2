const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Helper to replace setVaultNotes with one that saves to localStorage
code = code.replace(
  /setVaultNotes\(prev => prev\.map\(n => n\.id === activeNote\.id \? \{ \.\.\.n, \.\.\.updates \} : n\)\);/g,
  `setVaultNotes(prev => {
                            const newNotes = prev.map(n => n.id === activeNote.id ? { ...n, ...updates } : n);
                            if (currentUser) localStorage.setItem(\`s_os_notes_\${currentUser.uid}\`, JSON.stringify(newNotes));
                            return newNotes;
                          });`
);

code = code.replace(
  /setVaultNotes\(prev => prev\.map\(n => n\.id === activeNote\.id \? \{ \.\.\.n, content: updatedContent \} : n\)\);/g,
  `setVaultNotes(prev => {
            const newNotes = prev.map(n => n.id === activeNote.id ? { ...n, content: updatedContent } : n);
            if (currentUser) localStorage.setItem(\`s_os_notes_\${currentUser.uid}\`, JSON.stringify(newNotes));
            return newNotes;
          });`
);

code = code.replace(
  /setVaultNotes\(prev => prev\.filter\(n => n\.id !== activeNote\.id\)\);/g,
  `setVaultNotes(prev => {
                                      const newNotes = prev.filter(n => n.id !== activeNote.id);
                                      if (currentUser) localStorage.setItem(\`s_os_notes_\${currentUser.uid}\`, JSON.stringify(newNotes));
                                      return newNotes;
                                    });`
);

fs.writeFileSync('src/App.tsx', code);
