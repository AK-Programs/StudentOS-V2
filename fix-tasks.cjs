const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetLoad = `  // Tasks Sync
  useEffect(() => {
    if (!currentUser) return;
    try {
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
    }
  }, [currentUser]);`;

const newLoad = `  // Tasks Sync
  useEffect(() => {
    if (!currentUser) return;
    try {
      const rd = currentUser.raw_data || {};
      if (rd.tasks) {
        setTasks(rd.tasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setTasks([]);
    }
  }, [currentUser]);`;

const targetAdd = `  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !currentUser) return;
    const uid = currentUser.uid;
    const item: Task = {
      id: \`task-\${Date.now()}\`,
      title: newTaskTitle,
      completed: false,
      subject: newTaskSubject,
      userId: currentUser.uid,
      createdAt: new Date().toISOString()
    };
    try {
      const updated = [...tasks, item];
      setTasks(updated);
      localStorage.setItem(\`s_os_tasks_\${uid}\`, JSON.stringify(updated));
      setNewTaskTitle('');
      showNotification('New task milestone appended to local repository.');
    } catch (err: any) {
      console.error('Failed to add task:', err);
    }
  };`;

const newAdd = `  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !currentUser) return;
    const uid = currentUser.uid;
    const item: Task = {
      id: \`task-\${Date.now()}\`,
      title: newTaskTitle,
      completed: false,
      subject: newTaskSubject,
      userId: currentUser.uid,
      createdAt: new Date().toISOString()
    };
    try {
      const updated = [...tasks, item];
      setTasks(updated);
      const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), tasks: updated } };
      setCurrentUser(updatedUser);
      saveSupabaseUserProfile(updatedUser).catch(console.error);
      setNewTaskTitle('');
      showNotification('New task milestone appended to remote repository.');
    } catch (err: any) {
      console.error('Failed to add task:', err);
    }
  };`;

const targetToggle = `  const toggleTask = async (id: string) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updated);
    localStorage.setItem(\`s_os_tasks_\${uid}\`, JSON.stringify(updated));
  };`;

const newToggle = `  const toggleTask = async (id: string) => {
    if (!currentUser) return;
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updated);
    const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), tasks: updated } };
    setCurrentUser(updatedUser);
    saveSupabaseUserProfile(updatedUser).catch(console.error);
  };`;

const targetDelete = `  const deleteTask = async (id: string) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    localStorage.setItem(\`s_os_tasks_\${uid}\`, JSON.stringify(updated));
    showNotification('Task deleted.');
  };`;

const newDelete = `  const deleteTask = async (id: string) => {
    if (!currentUser) return;
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), tasks: updated } };
    setCurrentUser(updatedUser);
    saveSupabaseUserProfile(updatedUser).catch(console.error);
    showNotification('Task deleted.');
  };`;

if (code.includes('s_os_tasks')) {
  code = code.replace(targetLoad, newLoad);
  code = code.replace(targetAdd, newAdd);
  code = code.replace(targetToggle, newToggle);
  code = code.replace(targetDelete, newDelete);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Migrated Tasks to Supabase');
} else {
  console.log('Could not find Tasks storage targets');
}
