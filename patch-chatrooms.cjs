const fs = require('fs');
let content = fs.readFileSync('src/lib/supabaseChat.ts', 'utf8');

// Patch getChatRooms logic
const getChatRoomsPattern = /if \(description\.startsWith\('__JSON_METADATA__::'\)\) \{[\s\S]*?return \{[\s\S]*?\} as ChatRoom;/;
const getChatRoomsReplacement = `
        let members = [];
        let moderators = [];
        let creatorId = '';
        
        if (description.startsWith('__JSON_METADATA__::')) {
          try {
            const parsed = JSON.parse(description.substring('__JSON_METADATA__::'.length));
            description = parsed.description || '';
            code = parsed.code || '';
            type = parsed.type || 'group';
            icon = parsed.icon || '💬';
            members = parsed.members || [];
            moderators = parsed.moderators || [];
            creatorId = parsed.creatorId || '';
          } catch (_) {}
        } else {
           // Direct column mapping if we updated the DB schema later
           if (item.type) type = item.type;
           if (item.code) code = item.code;
           if (item.icon) icon = item.icon;
           if (item.creator_id) creatorId = item.creator_id;
           if (item.members) members = typeof item.members === 'string' ? JSON.parse(item.members) : item.members;
           if (item.moderators) moderators = typeof item.moderators === 'string' ? JSON.parse(item.moderators) : item.moderators;
        }

        return {
          id: item.id,
          name: item.name,
          description,
          code,
          type,
          icon,
          creatorId,
          members,
          moderators
        } as ChatRoom;`;

content = content.replace(getChatRoomsPattern, getChatRoomsReplacement);

// Patch saveChatRoom logic
const saveChatRoomPattern = /const metaPayload = \{[\s\S]*?description: \`__JSON_METADATA__::\$\{JSON\.stringify\(metaPayload\)\}\`\s*\};/;
const saveChatRoomReplacement = `const dbRow = {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      code: room.code,
      icon: room.icon,
      creator_id: room.creatorId,
      members: JSON.stringify(room.members || []),
      moderators: JSON.stringify(room.moderators || [])
    };`;

content = content.replace(saveChatRoomPattern, saveChatRoomReplacement);

fs.writeFileSync('src/lib/supabaseChat.ts', content);
console.log('Patched chat rooms DB functions');
