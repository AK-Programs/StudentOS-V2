const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    try {
      const localFeedbacks = localStorage.getItem('s_os_feedbacks');
      if (localFeedbacks && localFeedbacks !== "undefined") {
        setFeedbackPosts(JSON.parse(localFeedbacks));
      } else {
        setFeedbackPosts(INITIAL_FEEDBACK);
      }
    } catch (err) {
      console.error('[Sync] Failed to parse local feedbacks:', err);
      setFeedbackPosts(INITIAL_FEEDBACK);
    }`;

const newTarget = `    const loadFeedbacks = async () => {
      try {
        const { data, error } = await supabase.from('notes').select('*').eq('id', '__global_feedbacks__').single();
        if (data && data.content) {
          setFeedbackPosts(JSON.parse(data.content));
        } else {
          setFeedbackPosts(INITIAL_FEEDBACK);
        }
      } catch (e) {
        setFeedbackPosts(INITIAL_FEEDBACK);
      }
    };
    loadFeedbacks();`;

if (code.includes(target)) {
  code = code.replace(target, newTarget);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Replaced feedback load');
} else {
  console.log('Feedback load target not found');
}
