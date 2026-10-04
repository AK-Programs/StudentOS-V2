const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    try {
      const uid = currentUser.uid;
      const localTasks = localStorage.getItem(\`s_os_tasks_\${uid}\`);
      if (localTasks && localTasks !== "undefined") {
        setTasks(JSON.parse(localTasks));
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to parse local tasks:', err);
      setTasks([]);
    }`;

const newTarget = `    try {
      const rd = currentUser.raw_data || {};
      if (rd.tasks) {
        setTasks(rd.tasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setTasks([]);
    }`;

code = code.replace(target, newTarget);
fs.writeFileSync('src/App.tsx', code);
