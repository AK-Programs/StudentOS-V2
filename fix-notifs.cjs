const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetLoad = `  // Notifications sync
  useEffect(() => {
    if (!currentUser) return;
    try {
      const localNotifs = localStorage.getItem(\`s_os_notifications_\${currentUser.uid}\`);
      if (localNotifs && localNotifs !== "undefined") {
        setNotifications(JSON.parse(localNotifs));
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to parse notifications:', err);
    }
  }, [currentUser]);`;

const newLoad = `  // Notifications sync
  useEffect(() => {
    if (!currentUser) return;
    try {
      const rd = currentUser.raw_data || {};
      if (rd.notifications) {
        setNotifications(rd.notifications);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to parse notifications:', err);
    }
  }, [currentUser]);`;

const targetSaveHelper = `  const saveNotifs = (updated: any) => {
    setNotifications(updated);
    if (currentUser?.uid) {
      localStorage.setItem(\`s_os_notifications_\${currentUser.uid}\`, JSON.stringify(updated));
    }
  };`;

const newSaveHelper = `  const saveNotifs = (updated: any) => {
    setNotifications(updated);
    if (currentUser) {
      const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), notifications: updated } };
      setCurrentUser(updatedUser);
      saveSupabaseUserProfile(updatedUser).catch(console.error);
    }
  };`;

if (code.includes('s_os_notifications')) {
  // we can just replace localStorage.setItem(`s_os_notifications_${currentUser.uid}`, ...) directly
  // Wait, I will just replace all instances.
  code = code.replace(targetLoad, newLoad);
  
  // replace instances of localStorage.setItem(\`s_os_notifications_\${currentUser.uid}\`, JSON.stringify(updated));
  // Wait, they are inside functions like showNotification. Let me check if there's a helper or direct calls.
}

fs.writeFileSync('src/App.tsx', code);
console.log('Migrated Notifs part 1');
