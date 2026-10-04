const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `      setSchedules(prev => {
        const updated = [...prev, newSch];
        localStorage.setItem(\`s_os_schedules_\${uid}\`, JSON.stringify(updated));
        return updated;
      });`;

const new1 = `      setSchedules(prev => {
        const updated = [...prev, newSch];
        if (currentUser) {
          const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), schedules: updated } };
          setCurrentUser(updatedUser);
          saveSupabaseUserProfile(updatedUser).catch(e => {});
        }
        return updated;
      });`;

code = code.replace(target1, new1);
fs.writeFileSync('src/App.tsx', code);
console.log('Fixed schedules save');
