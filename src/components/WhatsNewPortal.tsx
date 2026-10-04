/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Rocket, Bug, Wrench, Shield, Check, CheckCheck, 
  Search, ArrowRight, ExternalLink, Calendar, User, Eye, 
  ChevronRight, Filter, RefreshCw, X, Layers, Image as ImageIcon,
  Clock, Tag, AlertCircle, Edit3
} from 'lucide-react';
import { SystemUpdate, SystemUpdateCategory, UserProfile, UserRole } from '../types';
import { 
  getPublishedUpdates, 
  getUserReadUpdateIds, 
  markUpdateAsRead, 
  markAllUpdatesAsRead 
} from '../lib/supabaseUpdates';

interface WhatsNewPortalProps {
  currentUser: UserProfile | null;
  effectiveRole?: string;
  onNavigateTab?: (tab: string) => void;
  onOpenAdminManager?: () => void;
}

export const CATEGORY_CONFIG: Record<SystemUpdateCategory, {
  label: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  dotColor: string;
}> = {
  feature: {
    label: 'New Feature',
    icon: '✨',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-400',
    border: 'border-indigo-500/30',
    dotColor: 'bg-indigo-400'
  },
  improvement: {
    label: 'Improvement',
    icon: '🚀',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400'
  },
  bugfix: {
    label: 'Bug Fix',
    icon: '🐛',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    border: 'border-amber-500/30',
    dotColor: 'bg-amber-400'
  },
  maintenance: {
    label: 'Maintenance',
    icon: '🔧',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-400',
    border: 'border-cyan-500/30',
    dotColor: 'bg-cyan-400'
  },
  security: {
    label: 'Security',
    icon: '🔒',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-400',
    border: 'border-rose-500/30',
    dotColor: 'bg-rose-400'
  }
};

export function renderMarkdownContent(content: string) {
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <div className="space-y-3 text-slate-200 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base sm:text-lg font-black text-white tracking-tight pt-2 border-b border-white/5 pb-1">
              {trimmed.substring(4)}
            </h3>
          );
        }
        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-sm font-bold text-indigo-300 pt-1">
              {trimmed.substring(5)}
            </h4>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.substring(2);
          const parts = itemText.split(/(\*\*.*?\*\*|`.*?`)/g);
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-2">
              <span className="text-indigo-400 font-bold select-none">•</span>
              <div className="flex-1">
                {parts.map((p, pIdx) => {
                  if (p.startsWith('**') && p.endsWith('**')) {
                    return <strong key={pIdx} className="text-white font-bold">{p.substring(2, p.length - 2)}</strong>;
                  }
                  if (p.startsWith('`') && p.endsWith('`')) {
                    return <code key={pIdx} className="bg-slate-950 px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-300 border border-white/10">{p.substring(1, p.length - 1)}</code>;
                  }
                  return <span key={pIdx}>{p}</span>;
                })}
              </div>
            </div>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-2 border-indigo-500/70 bg-indigo-950/20 px-3 py-2 rounded-r-xl text-slate-300 italic text-xs">
              {trimmed.substring(2)}
            </blockquote>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="h-1" />;
        }

        // Regular line with bold formatting
        const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
        return (
          <p key={idx} className="leading-relaxed">
            {parts.map((p, pIdx) => {
              if (p.startsWith('**') && p.endsWith('**')) {
                return <strong key={pIdx} className="text-white font-bold">{p.substring(2, p.length - 2)}</strong>;
              }
              if (p.startsWith('`') && p.endsWith('`')) {
                return <code key={pIdx} className="bg-slate-950 px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-300 border border-white/10">{p.substring(1, p.length - 1)}</code>;
              }
              return <span key={pIdx}>{p}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function WhatsNewPortal({
  currentUser,
  effectiveRole,
  onNavigateTab,
  onOpenAdminManager
}: WhatsNewPortalProps) {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const isSuperAdmin = (currentUser?.role === 'super_admin') || (effectiveRole === 'super_admin');
  const userRole = (effectiveRole as UserRole) || currentUser?.role || 'student';
  const userId = currentUser?.uid || currentUser?.email || 'guest';

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedUpdates, userReads] = await Promise.all([
        getPublishedUpdates(userRole),
        getUserReadUpdateIds(userId)
      ]);
      setUpdates(fetchedUpdates);
      setReadIds(userReads);
    } catch (err) {
      console.warn('Failed to load what\'s new updates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for real-time WebSocket push updates from server.ts
    const handleWsPublish = (e: any) => {
      if (e.detail?.type === 'whats_new:published') {
        loadData();
      }
    };
    window.addEventListener('studentos_whats_new_updated', handleWsPublish);
    return () => window.removeEventListener('studentos_whats_new_updated', handleWsPublish);
  }, [userRole, userId]);

  const handleMarkAsRead = async (updateId: string) => {
    if (!readIds.has(updateId)) {
      const nextSet = new Set(readIds);
      nextSet.add(updateId);
      setReadIds(nextSet);
      await markUpdateAsRead(updateId, userId);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = updates.filter(u => !readIds.has(u.id)).map(u => u.id);
    if (unreadIds.length === 0) return;
    const nextSet = new Set(readIds);
    unreadIds.forEach(id => nextSet.add(id));
    setReadIds(nextSet);
    await markAllUpdatesAsRead(userId, unreadIds);
  };

  // Filter updates by query and category
  const filteredUpdates = useMemo(() => {
    return updates.filter(u => {
      if (selectedCategory !== 'all' && u.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesVersion = u.version.toLowerCase().includes(q);
        const matchesTitle = u.title.toLowerCase().includes(q);
        const matchesSummary = u.summary.toLowerCase().includes(q);
        const matchesContent = u.content.toLowerCase().includes(q);
        if (!matchesVersion && !matchesTitle && !matchesSummary && !matchesContent) {
          return false;
        }
      }
      return true;
    });
  }, [updates, selectedCategory, searchQuery]);

  const unreadCount = useMemo(() => {
    return updates.filter(u => !readIds.has(u.id)).length;
  }, [updates, readIds]);

  const latestRelease = updates[0];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-5xl mx-auto pb-16">
      
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fadeIn cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 p-2 text-slate-300 hover:text-white bg-white/10 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={lightboxImage} 
              alt="Enlarged update preview" 
              className="rounded-2xl max-h-[80vh] w-auto object-contain border border-white/10 shadow-2xl" 
            />
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 p-6 opacity-10 text-9xl pointer-events-none select-none font-display">
          🚀
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Official Release Timeline
              </span>
              {latestRelease && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono text-[10px] font-bold">
                  Latest: {latestRelease.version}
                </span>
              )}
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white font-display tracking-tight">
              What’s New in StudentOS
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Explore official platform releases, new features, academic improvements, and security enhancements curated by the StudentOS engineering team.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-white/20 text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Mark All as Read</span>
              </button>
            )}

            {isSuperAdmin && onOpenAdminManager && (
              <button
                onClick={onOpenAdminManager}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Edit3 className="w-4 h-4" />
                <span>Super Admin Manager</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search version (e.g. v3.12), feature, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none px-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All Updates ({updates.length})
          </button>

          {(Object.keys(CATEGORY_CONFIG) as SystemUpdateCategory[]).map(catKey => {
            const config = CATEGORY_CONFIG[catKey];
            const isSelected = selectedCategory === catKey;
            const count = updates.filter(u => u.category === catKey).length;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? `${config.badgeBg} ${config.badgeText} ${config.border} border font-black shadow-sm`
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
                {count > 0 && <span className="opacity-60 text-[10px]">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Timeline Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-xs font-semibold">Retrieving official release notes...</p>
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-white/5 space-y-3">
          <div className="text-4xl">🔍</div>
          <h3 className="text-base font-bold text-white">No release notes found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery 
              ? `No updates matched "${searchQuery}". Try a different keyword or reset filters.`
              : 'There are currently no updates in this category.'}
          </p>
          {(searchQuery || selectedCategory !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-purple-500/50 before:to-transparent">
          {filteredUpdates.map((update, idx) => {
            const isRead = readIds.has(update.id);
            const cat = CATEGORY_CONFIG[update.category] || CATEGORY_CONFIG.feature;
            const formattedDate = update.publishedAt 
              ? new Date(update.publishedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              : 'Recent';

            return (
              <div 
                key={update.id}
                className="relative group transition-all"
                onMouseEnter={() => {
                  if (!isRead) handleMarkAsRead(update.id);
                }}
              >
                {/* Timeline Node Icon */}
                <div className={`absolute -left-6 sm:-left-8 top-5 w-5 h-5 rounded-full border-2 border-slate-950 flex items-center justify-center shadow-lg transition-transform group-hover:scale-125 ${
                  isRead ? 'bg-slate-700' : 'bg-indigo-500 animate-pulse ring-4 ring-indigo-500/20'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>

                {/* Release Card */}
                <div className={`rounded-2xl sm:rounded-3xl border p-5 sm:p-7 space-y-5 transition-all shadow-xl ${
                  update.isMajorRelease
                    ? 'bg-gradient-to-br from-slate-900/90 via-indigo-950/20 to-slate-900/90 border-indigo-500/30 shadow-indigo-500/5'
                    : 'bg-slate-900/60 backdrop-blur-xl border-white/5 hover:border-white/15'
                }`}>
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Version Pill */}
                        <span className="px-3 py-1 rounded-xl bg-white/10 text-white font-mono font-black text-xs sm:text-sm tracking-wide border border-white/10 shadow-inner">
                          {update.version}
                        </span>

                        {/* Category Badge */}
                        <span className={`px-2.5 py-0.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${cat.badgeBg} ${cat.badgeText} ${cat.border}`}>
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>

                        {/* Major Release Tag */}
                        {update.isMajorRelease && (
                          <span className="px-2.5 py-0.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                            🌟 Major Release
                          </span>
                        )}

                        {/* Unread Status Tag */}
                        {!isRead && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                            Unread
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg sm:text-2xl font-black text-white font-display tracking-tight leading-snug">
                        {update.title}
                      </h2>
                    </div>

                    {/* Metadata & Read toggle */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 text-[11px] text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formattedDate}</span>
                      </div>
                      
                      {!isRead ? (
                        <button
                          onClick={() => handleMarkAsRead(update.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Mark as read
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" /> Read
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Short Summary Callout */}
                  {update.summary && (
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                      💡 {update.summary}
                    </div>
                  )}

                  {/* Full Rich Markdown Content */}
                  <div className="prose prose-invert max-w-none pt-1">
                    {renderMarkdownContent(update.content)}
                  </div>

                  {/* Screenshots & Media Gallery */}
                  {update.mediaUrls && update.mediaUrls.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Visual Previews & Screenshots ({update.mediaUrls.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {update.mediaUrls.map((url, imgIdx) => (
                          <div 
                            key={imgIdx}
                            onClick={() => setLightboxImage(url)}
                            className="group/img relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-slate-950 cursor-pointer shadow-md"
                          >
                            <img 
                              src={url} 
                              alt={`Update preview ${imgIdx + 1}`} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" /> Enlarge
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Footer: Action Links and Author info */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Published by <strong className="text-slate-200">{update.authorName || 'Super Admin'}</strong></span>
                    </div>

                    {update.actionUrl && onNavigateTab && (
                      <button
                        onClick={() => {
                          handleMarkAsRead(update.id);
                          if (update.actionUrl?.startsWith('http')) {
                            window.open(update.actionUrl, '_blank', 'noopener,noreferrer');
                          } else if (onNavigateTab) {
                            onNavigateTab(update.actionUrl!);
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all flex items-center gap-2 group/btn cursor-pointer shadow-sm"
                      >
                        <span>{update.actionLabel || `Explore ${update.actionUrl.toUpperCase()}`}</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
