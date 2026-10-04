const fs = require('fs');

let code = fs.readFileSync('src/lib/supabaseChat.ts', 'utf8');

const getAiBuddyTarget = `    if (data) {
      // Map database row keys to camelCase frontend keys
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
      return mapped;
    }`;

const getAiBuddyReplace = `    if (data) {
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
      const locals = getLocalAiBuddyChats(userId);
      const mergedMap = new Map();
      locals.forEach(t => mergedMap.set(t.id, t));
      mapped.forEach(t => mergedMap.set(t.id, t));
      return Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    }`;

code = code.replace(getAiBuddyTarget, getAiBuddyReplace);

const getPeerTarget = `    if (data) {
      console.log(\`[SUPABASE-CHAT] MESSAGES_FETCHED successfully, MESSAGES_COUNT: \${data.length}\`);
      
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
      return mapped;
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

code = code.replace(getPeerTarget, getPeerReplace);
fs.writeFileSync('src/lib/supabaseChat.ts', code);
