const fs = require('fs');

let code = fs.readFileSync('src/lib/supabaseChat.ts', 'utf8');

const targetFunction = /export async function getPeerMessages\(\): Promise<ChatMessage\[\]> \{[\s\S]*?return getLocalMessages\(\);\n\}/;

const replaceFunction = `export async function getPeerMessages(): Promise<ChatMessage[]> {
  console.log('[SUPABASE-CHAT] Querying messages...');
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('not found')) {
        console.warn('[SUPABASE-CHAT] Table messages does not exist in Supabase yet. Falling back to localStorage.');
        return getLocalMessages();
      }
      throw error;
    }

    if (data) {
      const mapped = data.map(item => {
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
        } as ChatMessage;
      });
      const locals = getLocalMessages();
      const mergedMap = new Map();
      locals.forEach(m => mergedMap.set(m.id, m));
      mapped.forEach(m => mergedMap.set(m.id, m));
      return Array.from(mergedMap.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  } catch (err) {
    console.error('[SUPABASE-CHAT] Failed to get messages from Supabase, using localStorage:', err);
  }
  return getLocalMessages();
}`;

code = code.replace(targetFunction, replaceFunction);
fs.writeFileSync('src/lib/supabaseChat.ts', code);
