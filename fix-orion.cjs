const fs = require('fs');

let code = fs.readFileSync('src/components/StudentOSJarvis.tsx', 'utf8');

// Change handleGenerateNotes to dispatch event directly
code = code.replace(
  /setGeneratedNotesContent\(\{ title: topic, content: content \}\);/g,
  `setGeneratedNotesContent({ title: topic, content: content });
      
      // Auto-save to Lecture Notes
      const noteEvent = new CustomEvent('s_os_create_note', {
        detail: {
          title: topic.substring(0, 40) + ' Notes',
          content: content,
          subject: 'Orion Generated'
        }
      });
      window.dispatchEvent(noteEvent);
      showNotification(\`✓ Successfully auto-saved "\${topic}" packet to your Lecture Notes Vault!\`);`
);

fs.writeFileSync('src/components/StudentOSJarvis.tsx', code);
