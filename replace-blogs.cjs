const fs = require('fs');
let code = fs.readFileSync('src/components/BlogsPortal.tsx', 'utf8');

const targetFetch = `  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      // 1. Try to fetch from Supabase
      let fetched: BlogPost[] = [];
      try {
        const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          fetched = data.map(d => ({
            id: d.id,
            title: d.title,
            content: d.content,
            author: d.author,
            authorId: d.author_id,
            tags: d.tags || [],
            imageUrl: d.cover_image,
            isPublished: d.is_published,
            createdAt: new Date(d.created_at).getTime()
          }));
        }
      } catch (e) {
        console.warn("Supabase fetch failed", e);
      }

      // 2. Load from localStorage if Supabase empty
      let localCustom: BlogPost[] = [];
      const cached = localStorage.getItem('studentos_blogs');
      if (cached && cached !== "undefined") {
        localCustom = JSON.parse(cached);
      }
      
      const allPosts = [...starterTutorials as BlogPost[], ...localCustom, ...fetched];
      
      // Deduplicate by ID
      const uniquePosts = Array.from(new Map(allPosts.map(item => [item.id, item])).values());
      
      setPosts(uniquePosts.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Error fetching blogs:', error);
      setPosts(starterTutorials as BlogPost[]);
    }
    setIsLoading(false);
  };`;

const targetSave = `  const handleSavePost = async (postData: Partial<BlogPost>) => {
    try {
      const isNew = !postData.id;
      const newPost = {
        ...postData,
        id: postData.id || \`blog-\${Date.now()}\`,
        author: currentUser?.name || 'Unknown',
        authorId: currentUser?.uid || 'unknown',
        createdAt: postData.createdAt || Date.now(),
        isPublished: postData.isPublished || false
      };

      // 1. Save to Supabase
      try {
        await supabase.from('blogs').upsert({
          id: newPost.id,
          title: newPost.title,
          content: newPost.content,
          author: newPost.author,
          author_id: newPost.authorId,
          tags: newPost.tags,
          cover_image: newPost.imageUrl,
          is_published: newPost.isPublished,
          created_at: new Date(newPost.createdAt).toISOString()
        });
      } catch (e) {
        console.warn("Supabase save failed", e);
      }

      // 2. Save to localStorage
      const cached = localStorage.getItem('studentos_blogs');
      let localCustom: BlogPost[] = cached && cached !== "undefined" ? JSON.parse(cached) : [];
      if (isNew) {
        localCustom = [newPost as BlogPost, ...localCustom];
      } else {
        localCustom = localCustom.map(p => p.id === newPost.id ? (newPost as BlogPost) : p);
      }
      localStorage.setItem('studentos_blogs', JSON.stringify(localCustom));

      if (newPost.isPublished) {
        if (socketRef?.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'announcement:received',
            announcement: {
              id: \`blog-pub-\${Date.now()}\`,
              title: '📢 New Blog Published',
              description: \`A new blog "\${newPost.title}" was just published by \${newPost.author}.\`,
              date: new Date().toISOString()
            }
          }));
        }
      }

      setIsEditing(false);
      setCurrentPost(null);
      fetchPosts();
      showNotification(isNew ? 'Blog post created successfully!' : 'Blog post updated!');
    } catch (error) {
      console.error('Error saving blog:', error);
    }
  };`;

const targetDelete = `  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    try {
      // 1. Delete from Supabase
      try {
        await supabase.from('blogs').delete().eq('id', id);
      } catch (e) {}

      // 2. Delete from localStorage
      const cached = localStorage.getItem('studentos_blogs');
      let localCustom: BlogPost[] = cached && cached !== "undefined" ? JSON.parse(cached) : [];
      localCustom = localCustom.filter(p => p.id !== id);
      localStorage.setItem('studentos_blogs', JSON.stringify(localCustom));
      
      setViewingPost(null);
      fetchPosts();
      showNotification('Blog post deleted.');
    } catch (error) {
      console.error('Error deleting blog:', error);
    }
  };`;

const targetPublish = `  const handlePublishToggle = async (post: BlogPost) => {
    try {
      const updated = { ...post, isPublished: !post.isPublished };
      
      // 1. Update in Supabase
      try {
        await supabase.from('blogs').update({ is_published: updated.isPublished }).eq('id', post.id);
      } catch(e) {}

      // 2. Update in localStorage
      const cached = localStorage.getItem('studentos_blogs');
      let localCustom: BlogPost[] = cached && cached !== "undefined" ? JSON.parse(cached) : [];
      localCustom = localCustom.map(p => p.id === post.id ? updated : p);
      localStorage.setItem('studentos_blogs', JSON.stringify(localCustom));
      
      if (viewingPost?.id === post.id) {
        setViewingPost(updated);
      }
      
      fetchPosts();
      showNotification(updated.isPublished ? 'Blog post published!' : 'Blog post unpublished.');

      if (updated.isPublished) {
        if (socketRef?.current && socketRef.current.readyState === WebSocket.OPEN) {
           socketRef.current.send(JSON.stringify({
            type: 'announcement:received',
            announcement: {
              id: \`blog-pub-\${Date.now()}\`,
              title: '📢 New Blog Published',
              description: \`A new blog "\${updated.title}" was just published by \${updated.author}.\`,
              date: new Date().toISOString()
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
    }
  };`;

// Note: the socketRef usage in BlogsPortal might crash if we just removed WebSocket from App.tsx and it's passed as a prop, but wait, if it's passed as a prop, socketRef.current.send STILL WORKS because we shimmed it!

const newFetch = `  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
      
      let fetched: BlogPost[] = [];
      if (!error && data) {
        fetched = data.map(d => ({
          id: d.id,
          title: d.title,
          content: d.content,
          author: d.author,
          authorId: d.author_id,
          tags: d.tags || [],
          imageUrl: d.cover_image,
          isPublished: d.is_published,
          createdAt: new Date(d.created_at).getTime()
        }));
      }

      const allPosts = [...starterTutorials as BlogPost[], ...fetched];
      
      const uniquePosts = Array.from(new Map(allPosts.map(item => [item.id, item])).values());
      
      setPosts(uniquePosts.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Error fetching blogs:', error);
      setPosts(starterTutorials as BlogPost[]);
    }
    setIsLoading(false);
  };`;

const newSave = `  const handleSavePost = async (postData: Partial<BlogPost>) => {
    try {
      const isNew = !postData.id;
      const newPost = {
        ...postData,
        id: postData.id || \`blog-\${Date.now()}\`,
        author: currentUser?.name || 'Unknown',
        authorId: currentUser?.uid || 'unknown',
        createdAt: postData.createdAt || Date.now(),
        isPublished: postData.isPublished || false
      };

      await supabase.from('blogs').upsert({
        id: newPost.id,
        title: newPost.title,
        content: newPost.content,
        author: newPost.author,
        author_id: newPost.authorId,
        tags: newPost.tags,
        cover_image: newPost.imageUrl,
        is_published: newPost.isPublished,
        created_at: new Date(newPost.createdAt).toISOString()
      });

      if (newPost.isPublished) {
        if (socketRef?.current) {
          socketRef.current.send(JSON.stringify({
            type: 'announcement:received',
            announcement: {
              id: \`blog-pub-\${Date.now()}\`,
              title: '📢 New Blog Published',
              description: \`A new blog "\${newPost.title}" was just published by \${newPost.author}.\`,
              date: new Date().toISOString()
            }
          }));
        }
      }

      setIsEditing(false);
      setCurrentPost(null);
      fetchPosts();
      showNotification(isNew ? 'Blog post created successfully!' : 'Blog post updated!');
    } catch (error) {
      console.error('Error saving blog:', error);
    }
  };`;

const newDelete = `  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    try {
      await supabase.from('blogs').delete().eq('id', id);
      setViewingPost(null);
      fetchPosts();
      showNotification('Blog post deleted.');
    } catch (error) {
      console.error('Error deleting blog:', error);
    }
  };`;

const newPublish = `  const handlePublishToggle = async (post: BlogPost) => {
    try {
      const updated = { ...post, isPublished: !post.isPublished };
      
      await supabase.from('blogs').update({ is_published: updated.isPublished }).eq('id', post.id);
      
      if (viewingPost?.id === post.id) {
        setViewingPost(updated);
      }
      
      fetchPosts();
      showNotification(updated.isPublished ? 'Blog post published!' : 'Blog post unpublished.');

      if (updated.isPublished) {
        if (socketRef?.current) {
           socketRef.current.send(JSON.stringify({
            type: 'announcement:received',
            announcement: {
              id: \`blog-pub-\${Date.now()}\`,
              title: '📢 New Blog Published',
              description: \`A new blog "\${updated.title}" was just published by \${updated.author}.\`,
              date: new Date().toISOString()
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
    }
  };`;

if (code.includes('const fetchPosts = async () => {')) {
  code = code.replace(targetFetch, newFetch);
  code = code.replace(targetSave, newSave);
  code = code.replace(targetDelete, newDelete);
  code = code.replace(targetPublish, newPublish);
  fs.writeFileSync('src/components/BlogsPortal.tsx', code);
  console.log('Migrated Blogs to Supabase completely!');
} else {
  console.log('Could not find functions to replace');
}
