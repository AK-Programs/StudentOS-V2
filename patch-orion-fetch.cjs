const fs = require('fs');
let content = fs.readFileSync('src/components/StudentOSJarvis.tsx', 'utf8');

const regex = /  \/\/ Load diagnostic statistics and commands from Supabase\s*useEffect\(\(\) => \{/;
const replacement = `  // Load Orion chat history
  useEffect(() => {
    if (!currentUser?.uid) return;
    const fetchChatHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('orion_chats')
          .select('*')
          .eq('user_id', currentUser.uid)
          .order('created_at', { ascending: true });
          
        if (data && data.length > 0) {
          const messages = data.flatMap((chat: any) => [
            { role: 'user', text: chat.prompt },
            { role: 'assistant', text: chat.response }
          ]);
          // Add greeting if empty, but we already have one. Let's just set the messages.
          // Wait, we should probably prepend the greeting.
          setJarvisMessages([
             { role: 'assistant', text: "Greetings. I am Orion, your AI companion. I'm connected to the web. How can I assist with your studies today?" },
             ...messages
          ]);
        }
      } catch (err) {
        console.error("Failed to load Orion history", err);
      }
    };
    fetchChatHistory();
  }, [currentUser]);

  // Load diagnostic statistics and commands from Supabase
  useEffect(() => {`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/StudentOSJarvis.tsx', content);
console.log('Patched Orion chat history fetch');
