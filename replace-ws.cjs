const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const start = code.indexOf('// --- WebSocket Sync Client ---');
const endStr = '  }, []);\n\n';
const end = code.indexOf(endStr, start);

if (start !== -1 && end !== -1) {
  const replacement = `// --- Supabase Realtime Sync Client ---
  useEffect(() => {
    console.log('[Realtime] Establishing Supabase channel...');
    
    const channel = supabase.channel('student-os-public');

    // Setup socketRef mock for the rest of the app to seamlessly use Supabase broadcast
    socketRef.current = {
      readyState: 1, // WebSocket.OPEN
      send: (msgString: string) => {
        try {
          const payload = JSON.parse(msgString);
          channel.send({
            type: 'broadcast',
            event: 'ws_message',
            payload: payload
          });
        } catch (e) {
          console.error("Failed to parse and send broadcast:", e);
        }
      }
    };

    channel.on('broadcast', { event: 'ws_message' }, (payload) => {
      try {
        const data = payload.payload;
        if (!data) return;
        
        switch (data.type) {
          case 'chat:send':
            setChats(prev => {
              if (prev.some(c => c.id === data.chat.id)) return prev;
              return [...prev, data.chat];
            });
            setTimeout(() => {
              const view = document.getElementById('chat-scroll-view');
              if (view) view.scrollTop = view.scrollHeight;
            }, 40);
            break;

          case 'announcement:received':
            setAnnouncements(prev => {
              if (prev.some(a => a.id === data.announcement.id)) return prev;
              return [data.announcement, ...prev];
            });
            showNotification(\`📢 NEW ANNOUNCEMENT: \${data.announcement.title}\`);
            break;

          case 'homework:received':
            setHomeworkList(prev => {
              if (prev.some(h => h.id === data.homework.id)) return prev;
              return [data.homework, ...prev];
            });
            showNotification(\`📝 New Homework Released: \${data.homework.title}\`);
            break;

          case 'homework:updated':
            setHomeworkList(prev => prev.map(h => h.id === data.homework.id ? data.homework : h));
            break;

          case 'whiteboard:draw':
          case 'whiteboard:drawShape':
          case 'whiteboard:drawing':
            receiveRemoteWhiteboardDraw(data.data);
            break;

          case 'whiteboard:clear':
          case 'whiteboard:cleared':
            clearLocalCanvas();
            break;
        }
      } catch (err) {
        console.error('[Realtime] message process failure', err);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Connected successfully to Supabase!');
      }
    });

    return () => {
      supabase.removeChannel(channel);
      socketRef.current = null;
    };
  }, []);

`;
  code = code.substring(0, start) + replacement + code.substring(end + endStr.length);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Replaced WebSocket in App.tsx');
} else {
  console.log('Could not find start or end markers for WebSocket client');
}
