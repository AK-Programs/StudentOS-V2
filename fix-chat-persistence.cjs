const fs = require('fs');

let code = fs.readFileSync('src/lib/supabaseChat.ts', 'utf8');

// For AiBuddyChats
const targetAi = `    if (data) {
      // Map database row keys to camelCase frontend keys
      const mapped: AiBuddyThread[] = data.map(item => ({`;
const replaceAi = `    if (data) {
      // Map database row keys to camelCase frontend keys
      const mapped: AiBuddyThread[] = data.map(item => ({`;

const fullAiReplace = `    if (data) {
      const mapped: AiBuddyThread[] = data.map(item => ({
        id: item.id,
        title: item.title,
        personaId: item.persona_id,
        mode: item.mode,
        messages: typeof item.messages === 'string' ? JSON.parse(item.messages) : item.messages,
        attachedFiles: typeof item.attached_files === 'string' ? JSON.parse(item.attached_files) : item.attached_files || [],
        userId: item.user_id,
        createdAt: Number(item.created_at)
      }));
      // Merge with local storage
      const locals = getLocalAiBuddyChats(userId);
      const merged = [...locals];
      for (const t of mapped) {
        if (!merged.find(m => m.id === t.id)) merged.push(t);
      }
      return merged.sort((a, b) => b.createdAt - a.createdAt);
    }`;

code = code.replace(/    if \(data\) \{[\s\S]*?return mapped;\n    \}/g, fullAiReplace);
// Wait, the regex might be tricky, let me just do a simpler replacement

fs.writeFileSync('src/lib/supabaseChat.ts', code);
