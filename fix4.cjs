const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /{ role: 'assistant' as const, content: "Hey! 🚀 Welcome to your Campus AI workspace\. Here is what you can do:\n\n- \*\*Start New Chat Threads\*\*: Manage different lesson conversations seamlessly\.\n- \*\*Toggle Dynamic Learning Modes\*\*: Socratic guidance, deeper explanations, code coach reviews, and exam challenges\.\n- \*\*Analyze Uploaded Files\*\*: Drag and drop or browse standard codes, notes, chemistry formulae, or texts here to direct our context!\n\nJust start asking a question!" }/g,
  "{ role: 'assistant' as const, content: `Hey! 🚀 Welcome to your Campus AI workspace. Here is what you can do:\\n\\n- **Start New Chat Threads**: Manage different lesson conversations seamlessly.\\n- **Toggle Dynamic Learning Modes**: Socratic guidance, deeper explanations, code coach reviews, and exam challenges.\\n- **Analyze Uploaded Files**: Drag and drop or browse standard codes, notes, chemistry formulae, or texts here to direct our context!\\n\\nJust start asking a question!` }"
);

fs.writeFileSync('src/App.tsx', code);
