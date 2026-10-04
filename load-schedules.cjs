const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetLoad = `  // System Diagnostics Logging (CHAT_INIT, ROOMS_INIT, CURRENT_USER, CURRENT_ROLE)
  useEffect(() => {
    if (currentUser) {`;

const newLoad = `  // Load Schedules
  useEffect(() => {
    if (currentUser && currentUser.raw_data && currentUser.raw_data.schedules) {
      setSchedules(currentUser.raw_data.schedules);
    } else {
      setSchedules([]);
    }
  }, [currentUser]);

  // System Diagnostics Logging (CHAT_INIT, ROOMS_INIT, CURRENT_USER, CURRENT_ROLE)
  useEffect(() => {
    if (currentUser) {`;

code = code.replace(targetLoad, newLoad);
fs.writeFileSync('src/App.tsx', code);
console.log('Fixed load schedules');
