const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    try {
      const localNotifs = localStorage.getItem(\`s_os_notifications_\${currentUser.uid}\`);
      if (localNotifs && localNotifs !== "undefined") {
        setNotifications(JSON.parse(localNotifs));
      } else {
        setNotifications([]);
      }
    } catch (err) {`;

const newTarget = `    try {
      const rd = currentUser.raw_data || {};
      if (rd.notifications) {
        setNotifications(rd.notifications);
      } else {
        setNotifications([]);
      }
    } catch (err) {`;

code = code.replace(target, newTarget);
fs.writeFileSync('src/App.tsx', code);
console.log('Fixed load notifs');
