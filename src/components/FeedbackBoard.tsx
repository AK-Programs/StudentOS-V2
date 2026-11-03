import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, ThumbsUp, Plus, Search, Filter, CheckCircle2, 
  Clock, AlertCircle, Sparkles, X, ChevronRight, User, Shield, Send, MessageCircle
} from 'lucide-react';
import { UserRole, UserProfile, FeedbackPost } from '../types';

interface FeedbackBoardProps {
  currentUser: UserProfile | null;
  effectiveRole: UserRole;
  feedbackPosts: FeedbackPost[];
  handleAddFeedback: (newPost: Omit<FeedbackPost, 'id' | 'votes' | 'status' | 'replies' | 'createdAt'>) => void;
  upvoteFeedback: (id: string) => void;
  handleFacultyStatusUpdate: (id: string, status: 'pending' | 'under-review' | 'in-progress' | 'solved') => void;
  handleAddReply?: (postId: string, replyText: string) => void;
}

export const FeedbackBoard: React.FC<FeedbackBoardProps> = ({
  currentUser,
  effectiveRole,
  feedbackPosts,
  handleAddFeedback,
  upvoteFeedback,
  handleFacultyStatusUpdate,
  handleAddReply
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [newCategory, setNewCategory] = useState<'facilities' | 'academic' | 'events' | 'bug_report' | 'feature_request'>('facilities');
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');

  // Reply inline states
  const [activeReplyPostId, setActiveReplyPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const isStaff = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '');

  // Filter posts based on category, status, and search query
  const filteredPosts = feedbackPosts.filter(post => {
    const matchesCategory = activeCategory === 'all' || post.category === activeCategory;
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    const matchesSearch = 
      post.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.title && post.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      post.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    handleAddFeedback({
      author: currentUser?.name || 'StudentOS User',
      role: effectiveRole || 'student',
      category: newCategory,
      title: newTitle.trim() || undefined,
      text: newText.trim()
    });

    setNewTitle('');
    setNewText('');
    setIsModalOpen(false);
  };

  const handleReplySubmit = (postId: string) => {
    if (!replyText.trim() || !handleAddReply) return;
    handleAddReply(postId, replyText.trim());
    setReplyText('');
    setActiveReplyPostId(null);
  };

  const categoryLabels: Record<string, string> = {
    facilities: 'Facilities & Labs',
    academic: 'Coursework & Research',
    events: 'House Events & Sports',
    bug_report: 'Bug Report',
    feature_request: 'Feature Request'
  };

  const categoryIcons: Record<string, string> = {
    facilities: '🏫',
    academic: '📚',
    events: '🏆',
    bug_report: '🐛',
    feature_request: '💡'
  };

  const getStatusBadge = (status: FeedbackPost['status']) => {
    switch (status) {
      case 'solved':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle2 size={13} /> Solved</span>;
      case 'in-progress':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"><Clock size={13} /> In Progress</span>;
      case 'under-review':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"><Sparkles size={13} /> Under Review</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700"><AlertCircle size={13} /> Pending</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/20 backdrop-blur-xl shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <MessageSquare size={14} /> Student Voice & Community Forum
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
              Campus Feedback & Ideas
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Share suggestions, vote on campus updates, report bugs, and collaborate directly with faculty and administration.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm tracking-wide transition-all duration-200 shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Plus size={18} />
            Post Suggestion
          </button>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              activeCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All Categories
          </button>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                activeCategory === key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{categoryIcons[key]}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suggestions..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-950/80 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under-review">Under Review</option>
            <option value="in-progress">In Progress</option>
            <option value="solved">Solved</option>
          </select>
        </div>
      </div>

      {/* Feedback Feed */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-white/5 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-base font-bold text-white">No suggestions found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to share feedback, request a feature, or raise a campus suggestion.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredPosts.map((post) => {
              const isUpvoted = currentUser?.uid && post.upvotedBy?.includes(currentUser.uid);
              return (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="p-5 sm:p-6 rounded-3xl bg-slate-900/70 border border-white/10 hover:border-white/20 transition-all shadow-lg space-y-4"
                >
                  {/* Top Metadata Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-white font-bold text-sm">
                        {post.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{post.author}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 capitalize font-mono">
                            {post.role}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-indigo-300 text-xs font-medium flex items-center gap-1.5">
                        <span>{categoryIcons[post.category] || '💬'}</span>
                        <span>{categoryLabels[post.category] || post.category}</span>
                      </span>
                      {getStatusBadge(post.status)}
                    </div>
                  </div>

                  {/* Title & Body */}
                  <div className="space-y-1.5">
                    {post.title && (
                      <h3 className="text-base font-bold text-white tracking-tight">{post.title}</h3>
                    )}
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{post.text}</p>
                  </div>

                  {/* Card Actions & Footer */}
                  <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={() => upvoteFeedback(post.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                        isUpvoted
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      <ThumbsUp size={14} className={isUpvoted ? 'fill-current' : ''} />
                      <span>{isUpvoted ? 'Upvoted' : 'Upvote'}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-black/30 font-mono font-extrabold text-indigo-300">
                        {post.votes}
                      </span>
                    </button>

                    {/* Staff Status Controls */}
                    {isStaff && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-medium mr-1">Staff Action:</span>
                        <button
                          onClick={() => handleFacultyStatusUpdate(post.id, 'under-review')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            post.status === 'under-review' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleFacultyStatusUpdate(post.id, 'in-progress')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            post.status === 'in-progress' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          In Progress
                        </button>
                        <button
                          onClick={() => handleFacultyStatusUpdate(post.id, 'solved')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            post.status === 'solved' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          Solve
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Replies Thread */}
                  {post.replies && post.replies.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3 bg-black/30 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        <MessageCircle size={14} /> Official Responses ({post.replies.length})
                      </div>
                      <div className="space-y-2.5">
                        {post.replies.map((reply, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                {reply.author}
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                                  {reply.role}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(reply.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Reply Input (Staff / Faculty) */}
                  {isStaff && handleAddReply && (
                    <div className="pt-2">
                      {activeReplyPostId === post.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write official response..."
                            className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-indigo-500/40 text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleReplySubmit(post.id)}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => setActiveReplyPostId(null)}
                            className="p-2 text-slate-400 hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveReplyPostId(post.id)}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
                        >
                          <Send size={12} /> Add Official Response
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* New Suggestion Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 space-y-6 shadow-2xl relative"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white font-display">Create Campus Suggestion</h2>
                <p className="text-xs text-slate-400">Post constructive notes about facilities, scheduling resources, or features.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Category Tag</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-4 py-3 text-xs rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="facilities">🏫 Facilities & Labs</option>
                    <option value="academic">📚 Coursework & Research</option>
                    <option value="events">🏆 House Events & Sports</option>
                    <option value="bug_report">🐛 Bug Report</option>
                    <option value="feature_request">💡 Feature Request</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Title (Optional)</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Science Lab Equipment Request"
                    className="w-full px-4 py-3 text-xs rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Feedback Details</label>
                  <textarea
                    rows={4}
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Please describe your suggestion or feedback in detail..."
                    className="w-full p-4 text-xs rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
                  >
                    Publish Suggestion
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
