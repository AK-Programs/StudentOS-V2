const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetAdd = `  const handleAddSchedule = () => {
    if (!schSubject || !schTime) return;
    const item: ScheduleItem = {
      id: \`sch-\${Date.now()}\`,
      subject: schSubject,
      time: schTime,
      day: 'Monday'
    };
    setSchedules(prev => [...prev, item]);
    setSchSubject('');
    setSchTime('');
    showNotification('Schedule Interval Added');
  };`;

const newAdd = `  const handleAddSchedule = () => {
    if (!schSubject || !schTime) return;
    const item: ScheduleItem = {
      id: \`sch-\${Date.now()}\`,
      subject: schSubject,
      time: schTime,
      day: 'Monday'
    };
    setSchedules(prev => {
      const updated = [...prev, item];
      if (currentUser) {
        const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), schedules: updated } };
        setCurrentUser(updatedUser);
        saveSupabaseUserProfile(updatedUser).catch(e => {});
      }
      return updated;
    });
    setSchSubject('');
    setSchTime('');
    showNotification('Schedule Interval Added');
  };`;

const targetDelete = `  const handleDeleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(item => item.id !== id));
    showNotification('Schedule Interval Removed');
  };`;

const newDelete = `  const handleDeleteSchedule = (id: string) => {
    setSchedules(prev => {
      const updated = prev.filter(item => item.id !== id);
      if (currentUser) {
        const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), schedules: updated } };
        setCurrentUser(updatedUser);
        saveSupabaseUserProfile(updatedUser).catch(e => {});
      }
      return updated;
    });
    showNotification('Schedule Interval Removed');
  };`;

code = code.replace(targetAdd, newAdd);
code = code.replace(targetDelete, newDelete);
fs.writeFileSync('src/App.tsx', code);
console.log('Fixed handleAddSchedule');
