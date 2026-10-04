const fs = require('fs');
let code = fs.readFileSync('src/components/StudentOSJarvis.tsx', 'utf8');

const targetStr = `      const response = await fetch('/api/ai/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic,
          format: 'comprehensive',
          customPrompt: prompt
        })
      });`;

const replacementStr = `      const response = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: prompt,
          action: 'custom',
          instruction: 'You are an expert AI teacher generating structured markdown notes.'
        })
      });`;

if (code.includes('/api/ai/generate-notes')) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/components/StudentOSJarvis.tsx', code);
  console.log("Updated handleGenerateNotes to use /api/ai/notes");
} else {
  console.log("Not found or already updated.");
}
