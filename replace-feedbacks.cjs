const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const upvoteTarget = `  const upvoteFeedback = async (id: string) => {
    setFeedbackPosts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, votes: p.votes + 1 } : p);
      localStorage.setItem('s_os_feedbacks', JSON.stringify(updated));
      return updated;
    });
    showNotification('Upvoted successfully!');
  };`;

const newUpvote = `  const upvoteFeedback = async (id: string) => {
    if (!currentUser) return;
    setFeedbackPosts(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          const upvotedBy = p.upvotedBy || [];
          if (upvotedBy.includes(currentUser.uid)) {
            return p; // Already voted
          }
          return { ...p, votes: p.votes + 1, upvotedBy: [...upvotedBy, currentUser.uid] };
        }
        return p;
      });
      saveFeedbacksToSupabase(updated);
      return updated;
    });
    showNotification('Upvote registered.');
  };`;

const saveFunc = `
  const saveFeedbacksToSupabase = async (feedbacks: FeedbackPost[]) => {
    try {
      await supabase.from('notes').upsert({
        id: '__global_feedbacks__',
        title: 'Global Feedbacks',
        subject: 'System',
        content: JSON.stringify(feedbacks),
        created_at: new Date().toISOString()
      });
      // Sync to other users via realtime
      if (socketRef.current) {
         socketRef.current.send(JSON.stringify({
            type: 'broadcast',
            event: 'feedbacks:updated',
            payload: { feedbacks }
         }));
      }
    } catch(e) {
      console.warn("Failed saving feedbacks to supabase", e);
    }
  };
`;

code = code.replace(upvoteTarget, newUpvote + saveFunc);

const handlePostTarget = `  const handlePostFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackText.trim()) return;

    const post: FeedbackPost = {
      id: \`fb-\${Date.now()}\`,
      author: currentUser?.name || 'Anonymous',
      role: effectiveRole || 'student',
      text: newFeedbackText,
      votes: 0,
      category: newFeedbackCategory,
      status: 'pending',
      createdAt: new Date().toISOString(),
      replies: []
    };

    setFeedbackPosts(prev => {
      const updated = [post, ...prev];
      localStorage.setItem('s_os_feedbacks', JSON.stringify(updated));
      return updated;
    });
    setNewFeedbackText('');
    showNotification('Feedback posted directly to faculty bulletin boards.');
  };`;

const newHandlePost = `  const handlePostFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackText.trim()) return;

    const post: FeedbackPost = {
      id: \`fb-\${Date.now()}\`,
      author: currentUser?.name || 'Anonymous',
      authorId: currentUser?.uid,
      role: effectiveRole || 'student',
      text: newFeedbackText,
      votes: 0,
      upvotedBy: [],
      category: newFeedbackCategory,
      status: 'pending',
      createdAt: new Date().toISOString(),
      replies: []
    };

    setFeedbackPosts(prev => {
      const updated = [post, ...prev];
      saveFeedbacksToSupabase(updated);
      return updated;
    });
    setNewFeedbackText('');
    showNotification('Feedback posted directly to faculty bulletin boards.');
  };`;

code = code.replace(handlePostTarget, newHandlePost);

const statusTarget = `  const handleFacultyStatusUpdate = async (id: string, nextStatus: 'in-progress' | 'solved' | 'planned') => {
    setFeedbackPosts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: nextStatus } : p);
      localStorage.setItem('s_os_feedbacks', JSON.stringify(updated));
      return updated;
    });
    showNotification(\`Feedback status updated to: \${nextStatus.toUpperCase()}\`);
  };`;

const newStatus = `  const handleFacultyStatusUpdate = async (id: string, nextStatus: 'in-progress' | 'solved' | 'planned') => {
    setFeedbackPosts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: nextStatus } : p);
      saveFeedbacksToSupabase(updated);
      return updated;
    });
    showNotification(\`Feedback status updated to: \${nextStatus.toUpperCase()}\`);
  };`;

code = code.replace(statusTarget, newStatus);

fs.writeFileSync('src/App.tsx', code);
console.log('Feedback logic replaced');
