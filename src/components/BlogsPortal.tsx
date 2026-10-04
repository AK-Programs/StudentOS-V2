import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, BookOpen, Clock, User, X, Check, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveAppNotification } from '../lib/notifications';

const parseInlineMarkdown = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="mx-1 px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 font-mono text-[11px] text-amber-300 font-semibold">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const renderMarkdown = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, lIdx) => {
        if (line.trim() === '---' || line.trim() === '***') {
          return <hr key={lIdx} className="my-3 border-t border-white/10" />;
        }
        if (line.startsWith('### ')) {
          return <h4 key={lIdx} className="text-base font-extrabold text-indigo-300 mt-2 mb-1 tracking-tight">{parseInlineMarkdown(line.substring(4))}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={lIdx} className="text-lg font-black text-indigo-400 mt-3 mb-1.5 tracking-tight">{parseInlineMarkdown(line.substring(3))}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={lIdx} className="text-2xl font-black text-white mt-4 mb-2 tracking-wide">{parseInlineMarkdown(line.substring(2))}</h2>;
        }
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const raw = line.trim().substring(2);
          return (
            <ul key={lIdx} className="list-disc pl-5 my-0.5 text-slate-300">
              <li className="leading-relaxed">{parseInlineMarkdown(raw)}</li>
            </ul>
          );
        }
        if (/^\d+\.\s/.test(line.trim())) {
          const dotIdx = line.indexOf('.');
          const raw = line.substring(dotIdx + 1).trim();
          const num = line.trim().substring(0, dotIdx);
          return (
            <ol key={lIdx} className="list-decimal pl-5 my-0.5 text-slate-300" start={parseInt(num) || 1}>
              <li className="leading-relaxed">{parseInlineMarkdown(raw)}</li>
            </ol>
          );
        }
        if (line.trim().startsWith('>')) {
          const raw = line.trim().substring(1).trim();
          return (
            <blockquote key={lIdx} className="border-l-4 border-indigo-500/50 bg-indigo-500/5 pl-4 py-1.5 my-1.5 rounded-r-lg italic text-slate-300">
              {parseInlineMarkdown(raw)}
            </blockquote>
          );
        }
        if (!line.trim()) return <div key={lIdx} className="h-1.5" />;
        return <p key={lIdx} className="leading-relaxed mb-1 text-slate-300 text-sm">{parseInlineMarkdown(line)}</p>;
      })}
    </div>
  );
};

interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  tags: string[];
  imageUrl: string;
  isPublished: boolean;
  createdAt: number;
}

export const BlogsPortal = ({ currentUser, isSuperAdmin, showNotification }: any) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentPost, setCurrentPost] = useState<Partial<BlogPost> | null>(null);
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  const starterTutorials: Partial<BlogPost>[] = [
    {
      id: 'tut-1',
      title: 'Getting Started with StudentOS',
      content: '# Welcome to StudentOS\n\nStudentOS is your centralized hub for learning. Here is how to navigate the platform:\n\n1. **Dashboard**: Your overview of pending assignments, schedules, and active tasks.\n2. **Orion AI**: Use the floating mic icon to ask questions or generate study materials.\n3. **Classroom**: Access the SmartBoard for collaborative drawing and mind-mapping.\n4. **Lecture Notes**: Save AI-generated notes or write your own.',
      author: 'System Admin',
      authorId: 'system',
      tags: ['Tutorial', 'Getting Started'],
      imageUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=800&auto=format&fit=crop',
      isPublished: true,
      createdAt: Date.now() - 100000
    },
    {
      id: 'tut-2',
      title: 'How to Use Orion AI',
      content: '# Orion AI Copilot\n\nOrion is your personal academic assistant.\n\n### Features\n- **Web Search**: Orion can search the live internet to find verified educational resources.\n- **Notes Generation**: Ask Orion to "Create notes for Chapter 5", and it will generate a comprehensive study sheet.\n- **Automatic Saving**: Click "Save to Lecture Notes" to instantly persist Orion\'s output to your Vault.',
      author: 'System Admin',
      authorId: 'system',
      tags: ['Tutorial', 'AI'],
      imageUrl: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=800&auto=format&fit=crop',
      isPublished: true,
      createdAt: Date.now() - 200000
    },
    {
      id: 'tut-3',
      title: 'Whiteboard Guide',
      content: '# SmartBoard 2.0\n\nThe upgraded Whiteboard brings powerful visualization tools to your classroom.\n\n- **Shape Tool**: Select from rectangles, circles, triangles, arrows, and lines to draw diagrams.\n- **True Eraser**: The eraser tool now targets and deletes specific objects (lines or shapes) rather than just painting over them.\n- **Responsive Stroke**: Adjust brush size to change the thickness of pens, highlighters, and shapes.',
      author: 'System Admin',
      authorId: 'system',
      tags: ['Tutorial', 'Classroom'],
      imageUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800&auto=format&fit=crop',
      isPublished: true,
      createdAt: Date.now() - 300000
    },
    {
      id: 'tut-4',
      title: 'Attendance & Assignment Guide',
      content: '# Managing Your Academics\n\n### Attendance\nTeachers can log daily attendance using the visual grid, while students can track their own presence and streaks via their dashboard profile.\n\n### Assignments\nTeachers can create Homework entries with strict deadlines. Students can upload files (PDF/Images) directly to the assignment portal to mark them as completed.',
      author: 'System Admin',
      authorId: 'system',
      tags: ['Tutorial', 'Management'],
      imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800&auto=format&fit=crop',
      isPublished: true,
      createdAt: Date.now() - 400000
    }
  ];

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      let fetched: BlogPost[] = [];
      const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
      
      if (!error && data) {
        fetched = data.map((item: any) => ({
          id: item.id || `blog-${Date.now()}-${Math.random()}`,
          title: item.title || '',
          content: item.content || '',
          author: item.author || 'Anonymous',
          authorId: item.author_id || 'anonymous',
          tags: Array.isArray(item.tags) ? item.tags : [],
          imageUrl: item.image_url || 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=800&auto=format&fit=crop',
          isPublished: !!item.is_published,
          createdAt: Number(item.created_at || Date.now())
        }));
      }

      // Merge starter tutorials and fetched posts
      const allPosts = [...starterTutorials as BlogPost[], ...fetched];
      
      // Deduplicate by ID and filter out invalid/malformed posts
      const validPosts = allPosts.filter(p => p && typeof p === 'object' && p.id);
      const unique = Array.from(new Map(validPosts.map(p => [p.id, p])).values());
      setPosts(unique.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)));
    } catch (err) {
      console.error('Failed to fetch blogs:', err);
      setPosts(starterTutorials as BlogPost[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to realtime blog updates
    const channel = supabase.channel('blogs_channel');
    channel.on('broadcast', { event: 'blog_updated' }, () => {
      fetchPosts();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSave = async () => {
    if (!currentPost?.title || !currentPost?.content) {
      showNotification("Title and content are required.");
      return;
    }
    const isNew = !currentPost.id;
    const postData = {
      id: currentPost.id || `blog-${Date.now()}`,
      title: currentPost.title,
      content: currentPost.content,
      author: currentPost.author || currentUser?.name || 'Academic Writer',
      authorId: currentPost.authorId || currentUser?.uid || 'anonymous',
      tags: currentPost.tags || [],
      imageUrl: currentPost.imageUrl || 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=800&auto=format&fit=crop',
      isPublished: currentPost.isPublished !== undefined ? currentPost.isPublished : false,
      createdAt: currentPost.createdAt || Date.now()
    };

    const dbPostData = {
      id: postData.id,
      title: postData.title,
      content: postData.content,
      author: postData.author,
      author_id: postData.authorId,
      tags: postData.tags,
      image_url: postData.imageUrl,
      is_published: postData.isPublished,
      created_at: postData.createdAt
    };

    try {
      const { error } = await supabase.from('blogs').upsert([dbPostData]);
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Failed to sync blog to Supabase:', err);
      showNotification('Error saving blog post.');
      return;
    }

    showNotification(isNew ? 'Blog post created successfully!' : 'Blog post updated!');
    
    if (postData.isPublished) {
      const notifId = `blog_notif_${postData.id}_${Date.now()}`;
      const notifObj = {
        id: notifId,
        title: '📢 New Blog Published',
        message: `"${postData.title}" has been published by ${postData.author}.`,
        type: 'announcement' as const,
        createdAt: new Date().toISOString(),
        isRead: false,
        targetUserId: 'all',
        linkTab: 'blogs'
      };

      // 1. Save notification to database & broadcast event
      saveAppNotification(notifObj).catch(e => console.error(e));

      // 2. Broadcast live popup banner for all connected clients
      try {
        const channel = supabase.channel('student-os-public');
        channel.send({
          type: 'broadcast',
          event: 'principal_live_broadcast',
          payload: {
            id: notifId,
            title: '📢 New Blog Published',
            message: `"${postData.title}" by ${postData.author}`,
            senderName: postData.author,
            priority: 'normal',
            category: 'announcement',
            createdAt: new Date().toISOString()
          }
        });
      } catch (_) {}
    }

    setIsEditing(false);
    setCurrentPost(null);
    try {
      supabase.channel('blogs_channel').send({ type: 'broadcast', event: 'blog_updated' });
    } catch (_) {}
    fetchPosts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    // 2. Delete from Supabase
    try {
      const { error } = await supabase.from('blogs').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete blog from Supabase:', err);
      showNotification('Error deleting blog post.');
      return;
    }

    showNotification('Blog post deleted.');
    try {
      supabase.channel('blogs_channel').send({ type: 'broadcast', event: 'blog_updated' });
    } catch (_) {}
    fetchPosts();
  };

  const handlePublishToggle = async (post: BlogPost) => {
    const updatedPost = { ...post, isPublished: !post.isPublished };

    // 2. Sync to Supabase
    try {
      const { error } = await supabase.from('blogs').update({ is_published: !post.isPublished }).eq('id', post.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update publication status in Supabase:', err);
      showNotification('Error updating blog post status.');
      return;
    }

    showNotification(post.isPublished ? 'Post unpublished.' : 'Post published!');
    
    if (!post.isPublished) {
      const notifId = `blog_notif_${post.id}_${Date.now()}`;
      const notifObj = {
        id: notifId,
        title: '📢 New Blog Published',
        message: `"${post.title}" has been published by ${post.author}.`,
        type: 'announcement' as const,
        createdAt: new Date().toISOString(),
        isRead: false,
        targetUserId: 'all',
        linkTab: 'blogs'
      };

      saveAppNotification(notifObj).catch(e => console.error(e));

      try {
        const channel = supabase.channel('student-os-public');
        channel.send({
          type: 'broadcast',
          event: 'principal_live_broadcast',
          payload: {
            id: notifId,
            title: '📢 New Blog Published',
            message: `"${post.title}" by ${post.author}`,
            senderName: post.author,
            priority: 'normal',
            category: 'announcement',
            createdAt: new Date().toISOString()
          }
        });
      } catch (_) {}
    }

    fetchPosts();
  };

  const filteredPosts = posts.filter(p => {
    if (!p) return false;
    const title = p.title || '';
    const content = p.content || '';
    const tags = p.tags || [];
    const authorId = p.authorId || '';

    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || (activeCategory === 'tutorials' && tags.includes('Tutorial'));
    const matchesVisibility = p.isPublished || isSuperAdmin || (currentUser && authorId === currentUser.uid);
    return matchesSearch && matchesCategory && matchesVisibility;
  });

  if (viewingPost) {
    return (
      <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-20">
        <button onClick={() => setViewingPost(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" /> Back to Blogs
        </button>
        <div className="rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">
          <img src={viewingPost.imageUrl} alt={viewingPost.title} className="w-full h-64 object-cover" />
          <div className="p-8 md:p-12 space-y-6">
            <div className="flex flex-wrap gap-2">
              {(viewingPost.tags || []).map(t => (
                <span key={t} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold uppercase tracking-wider">{t}</span>
              ))}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white font-display leading-tight">{viewingPost.title}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-400 pb-8 border-b border-white/10">
              <span className="flex items-center gap-1"><User className="w-4 h-4" /> {viewingPost.author}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(viewingPost.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="prose prose-invert prose-indigo max-w-none text-slate-300">
              {renderMarkdown(viewingPost.content)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing && isSuperAdmin) {
    return (
      <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{currentPost?.id ? 'Edit Post' : 'Create New Post'}</h2>
          <button onClick={() => {setIsEditing(false); setCurrentPost(null);}} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4 shadow-xl">
          <input 
            type="text" 
            placeholder="Post Title" 
            value={currentPost?.title || ''} 
            onChange={e => setCurrentPost({...currentPost, title: e.target.value})}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
          />
          <input 
            type="text" 
            placeholder="Image URL (Unsplash)" 
            value={currentPost?.imageUrl || ''} 
            onChange={e => setCurrentPost({...currentPost, imageUrl: e.target.value})}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <input 
            type="text" 
            placeholder="Tags (comma separated, e.g. Tutorial, Science)" 
            value={currentPost?.tags?.join(', ') || ''} 
            onChange={e => setCurrentPost({...currentPost, tags: e.target.value.split(',').map(s => s.trim())})}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <textarea 
            placeholder="Markdown Content..." 
            value={currentPost?.content || ''} 
            onChange={e => setCurrentPost({...currentPost, content: e.target.value})}
            className="w-full h-96 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm resize-none custom-scrollbar"
          />
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={currentPost?.isPublished || false} 
              onChange={e => setCurrentPost({...currentPost, isPublished: e.target.checked})}
              id="publishToggle"
              className="w-4 h-4 accent-indigo-500"
            />
            <label htmlFor="publishToggle" className="text-sm text-slate-300">Publish immediately</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button onClick={() => {setIsEditing(false); setCurrentPost(null);}} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-colors flex items-center gap-2"><Check className="w-4 h-4" /> Save Post</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white font-display tracking-tight flex items-center gap-3"><BookOpen className="w-8 h-8 text-indigo-400" /> Educational Portal</h2>
          <p className="text-slate-400 text-sm">Read the latest articles, guides, and platform tutorials.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search articles..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {isSuperAdmin && (
            <button onClick={() => {setIsEditing(true); setCurrentPost({});}} className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all">
              <Plus className="w-4 h-4" /> New Post
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
        <button onClick={() => setActiveCategory('all')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeCategory === 'all' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white'}`}>All Articles</button>
        <button onClick={() => setActiveCategory('tutorials')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeCategory === 'tutorials' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white'}`}>Tutorials</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <div key={post.id} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/50 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] transition-all flex flex-col group relative">
              {!post.isPublished && <div className="absolute top-3 left-3 bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-md z-10 uppercase tracking-widest">Draft</div>}
              <div className="h-48 overflow-hidden relative cursor-pointer" onClick={() => setViewingPost(post)}>
                <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-80" />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex gap-2 flex-wrap mb-3">
                  {(post.tags || []).slice(0, 2).map(t => <span key={t} className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{t}</span>)}
                </div>
                <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => setViewingPost(post)}>{post.title || 'Untitled Article'}</h3>
                <p className="text-sm text-slate-400 line-clamp-3 mb-6 flex-1">{(post.content || '').replace(/[#*`]/g, '').substring(0, 150)}...</p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <span className="text-xs text-slate-500 font-medium">{post.author}</span>
                  <div className="flex items-center gap-2">
                    {isSuperAdmin && (
                      <>
                        <button onClick={(e) => {e.stopPropagation(); handlePublishToggle(post);}} className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800" title={post.isPublished ? "Unpublish" : "Publish"}>
                          {post.isPublished ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-50" />}
                        </button>
                        <button onClick={(e) => {e.stopPropagation(); setIsEditing(true); setCurrentPost(post);}} className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800"><Edit className="w-4 h-4" /></button>
                        <button onClick={(e) => {e.stopPropagation(); handleDelete(post.id);}} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
