const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `      setNotifications(prev => {
        const updated = [newNotif, ...prev];
        localStorage.setItem(\`s_os_notifications_\${currentUser.uid}\`, JSON.stringify(updated));
        return updated;
      });`;

const new1 = `      setNotifications(prev => {
        const updated = [newNotif, ...prev];
        if (currentUser) {
          const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), notifications: updated } };
          setCurrentUser(updatedUser);
          saveSupabaseUserProfile(updatedUser).catch(e => {});
        }
        return updated;
      });`;

const target2 = `      const updated = notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
      setNotifications(updated);
      if (currentUser) {
        localStorage.setItem(\`s_os_notifications_\${currentUser.uid}\`, JSON.stringify(updated));
      }`;

const new2 = `      const updated = notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
      setNotifications(updated);
      if (currentUser) {
        const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), notifications: updated } };
        setCurrentUser(updatedUser);
        saveSupabaseUserProfile(updatedUser).catch(e => {});
      }`;

const target3 = `      const updated = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updated);
      if (currentUser) {
        localStorage.setItem(\`s_os_notifications_\${currentUser.uid}\`, JSON.stringify(updated));
      }`;

const new3 = `      const updated = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updated);
      if (currentUser) {
        const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), notifications: updated } };
        setCurrentUser(updatedUser);
        saveSupabaseUserProfile(updatedUser).catch(e => {});
      }`;

const target4 = `      const updated = notifications.filter(n => n.id !== notifId);
      setNotifications(updated);
      if (currentUser) {
        localStorage.setItem(\`s_os_notifications_\${currentUser.uid}\`, JSON.stringify(updated));
      }`;

const new4 = `      const updated = notifications.filter(n => n.id !== notifId);
      setNotifications(updated);
      if (currentUser) {
        const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), notifications: updated } };
        setCurrentUser(updatedUser);
        saveSupabaseUserProfile(updatedUser).catch(e => {});
      }`;

code = code.replace(target1, new1);
code = code.replace(target2, new2);
code = code.replace(target3, new3);
code = code.replace(target4, new4);

fs.writeFileSync('src/App.tsx', code);
console.log('Fixed all notification storage to Supabase');
