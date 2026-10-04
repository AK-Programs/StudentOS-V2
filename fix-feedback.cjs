const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackText.trim()) return;

    const postId = generateUniqueId();
    const post: FeedbackPost = {
      id: postId,
      author: currentUser?.name || 'Student OS Guest',
      role: effectiveRole || 'student',
      text: newFeedbackText.trim(),
      votes: 1,
      category: newFeedbackCategory,
      status: 'pending',
      createdAt: new Date().toISOString(),
      replies: []
    };

    try {
      await setDoc(doc(db, 'feedbacks', postId), post);
      setNewFeedbackText('');
      showNotification('Feedback posted directly to faculty bulletin boards.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, \`feedbacks/\${postId}\`);
    }
  };

  const upvoteFeedback = async (id: string) => {
    const found = feedbackPosts.find(p => p.id === id);
    if (!found) return;
    try {
      showNotification('Upvoted successfully!');
      await updateDoc(doc(db, 'feedbacks', id), { votes: found.votes + 1 });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, \`feedbacks/\${id}\`);
    }
  };

  const handleFacultyStatusUpdate = async (id: string, nextStatus: 'in-progress' | 'solved' | 'planned') => {
    try {
      showNotification(\`Feedback status updated to: \${nextStatus.toUpperCase()}\`);
      await updateDoc(doc(db, 'feedbacks', id), { status: nextStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, \`feedbacks/\${id}\`);
    }
  };`;

const replace = `  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackText.trim()) return;

    const postId = generateUniqueId();
    const post: FeedbackPost = {
      id: postId,
      author: currentUser?.name || 'Student OS Guest',
      role: effectiveRole || 'student',
      text: newFeedbackText.trim(),
      votes: 1,
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
  };

  const upvoteFeedback = async (id: string) => {
    setFeedbackPosts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, votes: p.votes + 1 } : p);
      localStorage.setItem('s_os_feedbacks', JSON.stringify(updated));
      return updated;
    });
    showNotification('Upvoted successfully!');
  };

  const handleFacultyStatusUpdate = async (id: string, nextStatus: 'in-progress' | 'solved' | 'planned') => {
    setFeedbackPosts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: nextStatus } : p);
      localStorage.setItem('s_os_feedbacks', JSON.stringify(updated));
      return updated;
    });
    showNotification(\`Feedback status updated to: \${nextStatus.toUpperCase()}\`);
  };`;

code = code.replace(target, replace);
fs.writeFileSync('src/App.tsx', code);
