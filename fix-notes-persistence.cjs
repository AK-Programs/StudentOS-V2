const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('supabaseNotes')) {
  content = content.replace(
    "import { getSupabaseUserProfile", 
    "import { getVaultNotes, saveVaultNoteToSupabase, deleteVaultNoteFromSupabase } from './lib/supabaseNotes';\nimport { getSupabaseUserProfile"
  );
}

content = content.replace(
  /const localNotes = localStorage\.getItem\(`s_os_notes_\$\{uid\}`\);/g,
  `const dbNotes = await getVaultNotes(uid);\n        setVaultNotes(dbNotes);\n        const localNotes = null;`
);

content = content.replace(
  /localStorage\.setItem\(`s_os_notes_\$\{.*?\}`, JSON\.stringify\((.*?)\)\);/g,
  `(async () => {
       const newArr = $1;
       for (const n of newArr) {
          saveVaultNoteToSupabase(n).catch(()=>{});
       }
     })();`
);

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed notes persistence in App.tsx');
