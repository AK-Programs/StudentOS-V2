const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regexTasks = /localStorage\.setItem\(\`s_os_tasks_\$\{uid\}\`, JSON\.stringify\(updated\)\);/g;
code = code.replace(regexTasks, `const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), tasks: updated } };
      setCurrentUser(updatedUser);
      saveSupabaseUserProfile(updatedUser).catch(e => {});`);

const regexFeedbacks = /localStorage\.setItem\('s_os_feedbacks', JSON\.stringify\(updated\)\);/g;
code = code.replace(regexFeedbacks, `saveFeedbacksToSupabase(updated);`);

fs.writeFileSync('src/App.tsx', code);
