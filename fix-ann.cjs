const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    try {
      const localAnnouncements = localStorage.getItem('s_os_announcements');
      if (localAnnouncements && localAnnouncements !== "undefined") {
        setAnnouncements(JSON.parse(localAnnouncements));
      } else {
        setAnnouncements(INITIAL_ANNOUNCEMENTS);
      }
    } catch (err) {
      console.error('[Sync] Failed to parse local announcements:', err);
      setAnnouncements(INITIAL_ANNOUNCEMENTS);
    }`;

const newTarget = `    const loadAnnouncements = async () => {
      try {
        const { data } = await supabase.from('notes').select('*').eq('id', '__global_announcements__').single();
        if (data && data.content) {
          setAnnouncements(JSON.parse(data.content));
        } else {
          setAnnouncements(INITIAL_ANNOUNCEMENTS);
        }
      } catch (e) {
        setAnnouncements(INITIAL_ANNOUNCEMENTS);
      }
    };
    loadAnnouncements();`;

code = code.replace(target, newTarget);
fs.writeFileSync('src/App.tsx', code);
