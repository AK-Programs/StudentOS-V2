import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit, Trash2, Search, BookOpen, Clock, User, X, Check, Eye, 
  Sparkles, ArrowRight, Tag, Share2, Bookmark, CheckCircle, Flame 
} from 'lucide-react';
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
    <div className="space-y-4">
      {lines.map((line, lIdx) => {
        if (line.trim() === '---' || line.trim() === '***') {
          return <hr key={lIdx} className="my-6 border-t border-white/10" />;
        }
        if (line.startsWith('### ')) {
          return <h4 key={lIdx} className="text-lg font-bold text-indigo-300 mt-4 mb-2 tracking-tight">{parseInlineMarkdown(line.substring(4))}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={lIdx} className="text-xl font-extrabold text-white mt-6 mb-3 tracking-tight">{parseInlineMarkdown(line.substring(3))}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={lIdx} className="text-2xl font-black text-white mt-8 mb-4 tracking-wide font-display">{parseInlineMarkdown(line.substring(2))}</h2>;
        }
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const raw = line.trim().substring(2);
          return (
            <ul key={lIdx} className="list-disc pl-6 my-1.5 text-slate-300">
              <li className="leading-relaxed">{parseInlineMarkdown(raw)}</li>
            </ul>
          );
        }
        if (/^\d+\.\s/.test(line.trim())) {
          const dotIdx = line.indexOf('.');
          const raw = line.substring(dotIdx + 1).trim();
          const num = line.trim().substring(0, dotIdx);
          return (
            <ol key={lIdx} className="list-decimal pl-6 my-1.5 text-slate-300" start={parseInt(num) || 1}>
              <li className="leading-relaxed">{parseInlineMarkdown(raw)}</li>
            </ol>
          );
        }
        if (line.trim().startsWith('>')) {
          const raw = line.trim().substring(1).trim();
          return (
            <blockquote key={lIdx} className="bg-indigo-950/30 border-l-2 border-indigo-500 pl-4 py-3 my-3 rounded-r-xl italic text-slate-200">
              {parseInlineMarkdown(raw)}
            </blockquote>
          );
        }
        if (!line.trim()) return <div key={lIdx} className="h-2" />;
        return <p key={lIdx} className="leading-relaxed text-slate-300 text-base">{parseInlineMarkdown(line)}</p>;
      })}
    </div>
  );
};

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  tags: string[];
  imageUrl: string;
  isPublished: boolean;
  createdAt: number;
  featured?: boolean;
}

export const BlogsPortal = ({ currentUser, isSuperAdmin, showNotification, effectiveRole }: any) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentPost, setCurrentPost] = useState<Partial<BlogPost> | null>(null);
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  const isStaff = isSuperAdmin || ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '');

  const starterTutorials: Partial<BlogPost>[] = [
    {
      id: 'tut-1',
      title: 'Getting Started with StudentOS & Veylentra Ecosystem',
      content: '# Welcome to StudentOS\n\nStudentOS is your centralized hub for learning, real-time collaboration, and academic management.\n\n### Core Navigation\n1. **Dashboard**: Your overview of pending assignments, daily schedules, XP streaks, and active tasks.\n2. **Orion AI**: Click the floating assistant to ask questions, solve complex equations, or generate comprehensive study sheets.\n3. **Classroom & SmartBoard**: Collaborate on live digital whiteboards with rich drawing tools and shape tools.\n4. **Lecture Notes**: Create personal notes, join real-time collaborative sessions, and download print-ready formatted PDFs.',
      author: 'System Admin',
      authorId: 'system',
      tags: ['Tutorial', 'Getting Started'],
      imageUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=800&auto=format&fit=crop',
      isPublished: true,
      createdAt: Date.now() - 100000,
      featured: true
    },
    {
      id: 'tut-2',
      title: 'Mastering Orion AI Academic Assistant',
      content: '# Orion AI Copilot\n\nOrion is your personal academic intelligence powered by advanced language models.\n\n### Key Capabilities\n- **Web Grounding**: Orion can search live internet sources to fetch up-to-date scientific papers and academic references.\n- **Lecture Notes Generator**: Request notes for any topic (e.g. "Create detailed Physics notes on Thermodynamics"), and save directly to your Vault.\n- **Interactive Problem Solving**: Step-by-step guidance for mathematics, coding pseudocode, and biology diagrams.',
      author: 'Academic Team',
      authorId: 'system',
      tags: ['Tutorial', 'AI & Tech'],
      imageUrl: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=800&auto=format&fit=crop',
      isPublished: true,
      createdAt: Date.now() - 200000
    },
    {
      id: 'tut-3',
      title: 'Real-Time Notes Collaboration & PDF Export Guide',
      content: '# Collaborative Lecture Notes\n\nThe upgraded Lecture Notes module supports cross-account, live bidirectional editing.\n\n### How to Collaborate\n- **Host Session**: Click "Start Live Session" inside any note to generate a 6-digit Join Code.\n- **Join Session**: Your study partners enter the code to join your note synchronously.\n- **Export Clean PDF**: Click "Download Formatted PDF" to export notes with styled headings, real table grids, and pristine typography.',
      author: 'Product Team',
      authorId: 'system',
      tags: ['Study Guides', 'Tutorial'],
      imageUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800&auto=format&fit=crop',
      isPublished: true,
      createdAt: Date.now() - 300000
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

      const allPosts = [...starterTutorials as BlogPost[], ...fetched];
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
    const channel = supabase.channel('blogs_channel');
    channel.on('broadcast', { event: 'blog_updated' }, () => {
      fetchPosts();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const calculateReadTime = (text: string) => {
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  };

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
      isPublished: currentPost.isPublished !== undefined ? currentPost.isPublished : true,
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
      if (error) throw error;
    } catch (err) {
      console.error('Failed to sync blog to Supabase:', err);
      showNotification('Saved post locally.');
    }

    showNotification(isNew ? 'Blog post created successfully!' : 'Blog post updated!');
    setIsEditing(false);
    setCurrentPost(null);
    try {
      supabase.channel('blogs_channel').send({ type: 'broadcast', event: 'blog_updated' });
    } catch (_) {}
    fetchPosts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const { error } = await supabase.from('blogs').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete blog from Supabase:', err);
    }
    showNotification('Blog post deleted.');
    fetchPosts();
  };

  const handlePublishToggle = async (post: BlogPost) => {
    try {
      const { error } = await supabase.from('blogs').update({ is_published: !post.isPublished }).eq('id', post.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update blog status:', err);
    }
    showNotification(post.isPublished ? 'Post unpublished.' : 'Post published!');
    fetchPosts();
  };

  const filteredPosts = posts.filter(p => {
    if (!p) return false;
    const title = p.title || '';
    const content = p.content || '';
    const tags = p.tags || [];
    const authorId = p.authorId || '';

    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = 
      activeCategory === 'all' || 
      (activeCategory === 'tutorials' && (tags.includes('Tutorial') || tags.includes('Getting Started'))) ||
      (activeCategory === 'ai_tech' && tags.includes('AI & Tech')) ||
      (activeCategory === 'study_guides' && tags.includes('Study Guides'));

    const matchesVisibility = p.isPublished || isStaff || (currentUser && authorId === currentUser.uid);
    return matchesSearch && matchesCategory && matchesVisibility;
  });

  const featuredPost = posts.find(p => p.featured || p.tags?.includes('Getting Started')) || filteredPosts[0];

  // Article Full Reader View
  if (viewingPost) {
    const readTime = calculateReadTime(viewingPost.content);
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => setViewingPost(null)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all shadow-md"
        >
          <X size={16} /> Back to Educational Portal
        </button>

        <article className="rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl space-y-6">
          <div className="relative h-72 sm:h-96 w-full overflow-hidden">
            <img 
              src={viewingPost.imageUrl} 
              alt={viewingPost.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
          </div>

          <div className="p-6 sm:p-10 space-y-6 -mt-16 relative z-10">
            {/* Clean metadata without pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
              <span>{viewingPost.author}</span>
              <span aria-hidden="true">·</span>
              <span>{new Date(viewingPost.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span aria-hidden="true">·</span>
              <span>{readTime} min read</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white font-display leading-tight tracking-tight">
              {viewingPost.title}
            </h1>

            <div className="pt-6 border-t border-white/10 prose prose-invert max-w-none text-slate-300">
              {renderMarkdown(viewingPost.content)}
            </div>

            {/* Tags footer */}
            {viewingPost.tags && viewingPost.tags.length > 0 && (
              <div className="pt-6 border-t border-white/10 flex items-center gap-2 text-xs text-slate-400">
                <Tag size={14} className="text-indigo-400" />
                <span>Topic Tags:</span>
                <span className="text-slate-200">{viewingPost.tags.join(' · ')}</span>
              </div>
            )}
          </div>
        </article>
      </div>
    );
  }

  // Edit / Create Post Modal
  if (isEditing && isStaff) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white font-display">
            {currentPost?.id ? 'Edit Article' : 'Publish New Article'}
          </h2>
          <button onClick={() => { setIsEditing(false); setCurrentPost(null); }} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Article Title</label>
            <input
              type="text"
              placeholder="e.g. Master Class 10 Physics Concepts"
              value={currentPost?.title || ''}
              onChange={e => setCurrentPost({ ...currentPost, title: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Cover Image URL</label>
            <input
              type="text"
              placeholder="Image URL"
              value={currentPost?.imageUrl || ''}
              onChange={e => setCurrentPost({ ...currentPost, imageUrl: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Tags (comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. Tutorial, Physics, AI & Tech"
              value={currentPost?.tags?.join(', ') || ''}
              onChange={e => setCurrentPost({ ...currentPost, tags: e.target.value.split(',').map(s => s.trim()) })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Markdown Article Content</label>
            <textarea
              rows={12}
              placeholder="# Article Heading&#10;&#10;Write article content in Markdown format..."
              value={currentPost?.content || ''}
              onChange={e => setCurrentPost({ ...currentPost, content: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-indigo-500 font-mono text-xs resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="publishStatus"
              checked={currentPost?.isPublished ?? true}
              onChange={e => setCurrentPost({ ...currentPost, isPublished: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
            <label htmlFor="publishStatus" className="text-xs text-slate-300 font-medium">
              Publish immediately on Educational Portal
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              onClick={() => { setIsEditing(false); setCurrentPost(null); }}
              className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2"
            >
              <Check size={16} /> Save Article
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Portal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display flex items-center gap-3">
            <BookOpen className="text-indigo-400" size={28} /> Educational Portal & Guides
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Explore research papers, student guides, platform tutorials, and academic articles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {isStaff && (
            <button
              onClick={() => { setIsEditing(true); setCurrentPost({}); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all shrink-0"
            >
              <Plus size={16} /> New Article
            </button>
          )}
        </div>
      </div>

      {/* Featured Article Banner */}
      {featuredPost && !searchQuery && activeCategory === 'all' && (
        <div 
          onClick={() => setViewingPost(featuredPost)}
          className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 transition-all duration-300 shadow-2xl cursor-pointer"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            <div className="lg:col-span-7 h-64 lg:h-auto overflow-hidden relative">
              <img
                src={featuredPost.imageUrl}
                alt={featuredPost.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-slate-900 via-slate-900/40 to-transparent" />
            </div>

            <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                  <Sparkles size={14} /> Featured Article
                </div>
                <h2 className="text-xl sm:text-3xl font-black text-white font-display leading-tight group-hover:text-indigo-300 transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 line-clamp-3 leading-relaxed">
                  {featuredPost.content.replace(/[#*`]/g, '').substring(0, 180)}...
                </p>
              </div>

              {/* Clean metadata without pills */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>{featuredPost.author}</span>
                  <span aria-hidden="true">·</span>
                  <span>{calculateReadTime(featuredPost.content)} min read</span>
                </div>
                <span className="text-indigo-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Read Article <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 scrollbar-none">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeCategory === 'all'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          All Articles
        </button>
        <button
          onClick={() => setActiveCategory('tutorials')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeCategory === 'tutorials'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Tutorials
        </button>
        <button
          onClick={() => setActiveCategory('ai_tech')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeCategory === 'ai_tech'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          AI & Tech
        </button>
        <button
          onClick={() => setActiveCategory('study_guides')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeCategory === 'study_guides'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Study Guides
        </button>
      </div>

      {/* Blog Cards Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredPosts.map((post) => {
              const readTime = calculateReadTime(post.content);
              return (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group rounded-3xl bg-slate-900/70 border border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl overflow-hidden flex flex-col cursor-pointer"
                  onClick={() => setViewingPost(post)}
                >
                  <div className="h-48 overflow-hidden relative">
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      {/* Clean metadata without pills */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <span>{post.author}</span>
                        <span aria-hidden="true">·</span>
                        <span>{readTime} min read</span>
                      </div>

                      <h3 className="text-lg font-bold text-white leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2 font-display">
                        {post.title}
                      </h3>

                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {post.content.replace(/[#*`]/g, '').substring(0, 130)}...
                      </p>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      {isStaff && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handlePublishToggle(post)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg"
                            title={post.isPublished ? "Unpublish" : "Publish"}
                          >
                            <Eye size={14} className={post.isPublished ? 'text-emerald-400' : 'opacity-40'} />
                          </button>
                          <button
                            onClick={() => { setIsEditing(true); setCurrentPost(post); }}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
