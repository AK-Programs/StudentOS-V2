const fs = require('fs');

const getPeerTarget = `    if (data) {
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
      const locals = getLocalMessages();
      const merged = [...locals];
      for (const t of mapped) {
        if (!merged.find(m => m.id === t.id)) merged.push(t);
      }
      return merged.sort((a, b) => b.createdAt - a.createdAt);
    }`;

const getPeerReplace = `    if (data) {
      const mapped: ChatMessage[] = data.map(item => {
        let parsedDate = new Date();
        if (item.created_at) {
          const numVal = Number(item.created_at);
          if (!isNaN(numVal) && item.created_at.toString().length > 10) {
            parsedDate = new Date(numVal);
          } else {
            parsedDate = new Date(item.created_at);
          }
        }
        return {
          id: item.id,
          name: item.name,
          role: item.role,
          house: item.house,
          message: item.message,
          createdAt: parsedDate.toISOString(),
          targetId: item.target_id || item.room_id || null, // handle room_id alias just in case
          sharedMaterialId: item.shared_material_id,
          ownerUid: item.owner_uid
        };
      });
      const locals = getLocalMessages();
      const mergedMap = new Map();
      locals.forEach(m => mergedMap.set(m.id, m));
      mapped.forEach(m => mergedMap.set(m.id, m));
      return Array.from(mergedMap.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }`;

let code = fs.readFileSync('src/lib/supabaseChat.ts', 'utf8');

const lastIndexOfIfData = code.lastIndexOf('if (data) {');
if (lastIndexOfIfData !== -1) {
  const p1 = code.substring(0, lastIndexOfIfData);
  const p2 = code.substring(lastIndexOfIfData);
  const newP2 = p2.replace(/if \(data\) \{[\s\S]*?return merged\.sort\(\(a, b\) => b\.createdAt - a\.createdAt\);\n    \}/, getPeerReplace);
  fs.writeFileSync('src/lib/supabaseChat.ts', p1 + newP2);
}
