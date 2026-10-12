/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Check, CheckCheck, Search, ArrowRight, Calendar, User, Eye, 
  RefreshCw, X, Image as ImageIcon, Edit3, Layers
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
    label: 'New',
    icon: '✨',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-300',
    border: 'border-indigo-500/30',
    dotColor: 'bg-indigo-400'
  },
  improvement: {
    label: 'Improved',
    icon: '🚀',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    border: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400'
  },
  bugfix: {
    label: 'Fixed',
    icon: '🐛',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-300',
    border: 'border-amber-500/30',
    dotColor: 'bg-amber-400'
  },
  maintenance: {
    label: 'Maintenance',
    icon: '🔧',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-300',
    border: 'border-cyan-500/30',
    dotColor: 'bg-cyan-400'
  },
  security: {
    label: 'Security',
    icon: '🔒',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-300',
    border: 'border-rose-500/30',
    dotColor: 'bg-rose-400'
  }
};

export function renderMarkdownContent(content: string) {
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <div className="space-y-2.5 text-slate-300 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm sm:text-base font-bold text-white tracking-tight pt-2 border-b border-white/5 pb-1">
              {trimmed.substring(4)}
            </h3>
          );
        }
        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-xs sm:text-sm font-bold text-indigo-300 pt-1">
              {trimmed.substring(5)}
            </h4>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.substring(2);
          const parts = itemText.split(/(\*\*.*?\*\*|`.*?`)/g);
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="text-indigo-400 font-bold select-none mt-0.5">•</span>
              <div className="flex-1">
                {parts.map((p, pIdx) => {
                  if (p.startsWith('**') && p.endsWith('**')) {
                    return <strong key={pIdx} className="text-white font-semibold">{p.substring(2, p.length - 2)}</strong>;
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
            <blockquote key={idx} className="bg-slate-950/60 border border-white/10 px-3.5 py-2.5 rounded-xl text-slate-300 italic text-xs">
              {trimmed.substring(2)}
            </blockquote>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="h-1" />;
        }

        const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
        return (
          <p key={idx} className="leading-relaxed">
            {parts.map((p, pIdx) => {
              if (p.startsWith('**') && p.endsWith('**')) {
                return <strong key={pIdx} className="text-white font-semibold">{p.substring(2, p.length - 2)}</strong>;
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
      // De-duplicate by id to prevent duplicate release entries
      const seen = new Set<string>();
      const uniqueUpdates = fetchedUpdates.filter(u => {
        if (!u.id || seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });
      setUpdates(uniqueUpdates);
      setReadIds(userReads);
    } catch (err) {
      console.warn('Failed to load what\'s new updates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const featuredRelease = useMemo(() => {
    if (searchQuery.trim() || selectedCategory !== 'all') return null;
    return filteredUpdates.find(u => u.isMajorRelease) || null;
  }, [filteredUpdates, searchQuery, selectedCategory]);

  const timelineUpdates = useMemo(() => {
    if (!featuredRelease) return filteredUpdates;
    return filteredUpdates.filter(u => u.id !== featuredRelease.id);
  }, [filteredUpdates, featuredRelease]);

  const formatDate = (iso?: string) => {
    if (!iso) return 'Recent';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
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
                alt="Release screenshot preview" 
                className="rounded-2xl max-h-[80vh] w-auto object-contain border border-white/10 shadow-2xl" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Heading & Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="bento-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="text-indigo-400 font-semibold">Product Updates & Changelog</span>
            {updates[0] && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-300">{updates[0].version}</span>
              </>
            )}
            {unreadCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-400 font-semibold">{unreadCount} unread</span>
              </>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight">
            What’s New in StudentOS
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            A chronological record of new platform capabilities, academic workflow improvements, bug fixes, and security updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>Mark All as Read</span>
            </button>
          )}

          {isSuperAdmin && onOpenAdminManager && (
            <button
              onClick={onOpenAdminManager}
              className="uiverse-btn-primary px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Manage Releases</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Search & Category Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by version, title, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-transparent text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none px-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All ({updates.length})
          </button>

          {(Object.keys(CATEGORY_CONFIG) as SystemUpdateCategory[]).map(catKey => {
            const config = CATEGORY_CONFIG[catKey];
            const isSelected = selectedCategory === catKey;
            const count = updates.filter(u => u.category === catKey).length;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{config.label}</span>
                {count > 0 && <span className="opacity-70 font-mono text-[10px]">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading / Empty / Release Entries */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bento-card rounded-2xl p-6 space-y-3 animate-pulse">
              <div className="h-4 w-40 bg-white/10 rounded" />
              <div className="h-6 w-2/3 bg-white/10 rounded" />
              <div className="h-16 w-full bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="bento-card p-12 text-center rounded-3xl space-y-3">
          <Layers className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No release entries found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery 
              ? `No release notes matched "${searchQuery}". Try another keyword or reset your filters.`
              : 'There are currently no published updates in this category.'}
          </p>
          {(searchQuery || selectedCategory !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Visually Distinct Featured Update (when a major release exists) */}
          {featuredRelease && (() => {
            const isRead = readIds.has(featuredRelease.id);
            const cat = CATEGORY_CONFIG[featuredRelease.category] || CATEGORY_CONFIG.feature;
            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                onMouseEnter={() => { if (!isRead) handleMarkAsRead(featuredRelease.id); }}
                className="rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900/90 to-slate-900 border border-indigo-500/35 p-6 sm:p-8 space-y-5 shadow-xl relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                      <span className="font-semibold text-indigo-300">Featured Release</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-bold text-white">{featuredRelease.version}</span>
                      <span aria-hidden="true">·</span>
                      <span className={cat.badgeText}>{cat.label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400 font-mono">{formatDate(featuredRelease.publishedAt)}</span>
                      {!isRead && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-rose-400 font-bold">Unread</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                      {featuredRelease.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isRead ? (
                      <button
                        onClick={() => handleMarkAsRead(featuredRelease.id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Mark as read
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3.5 h-3.5" /> Read
                      </span>
                    )}
                  </div>
                </div>

                {featuredRelease.summary && (
                  <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                    {featuredRelease.summary}
                  </p>
                )}

                <div className="pt-1">
                  {renderMarkdownContent(featuredRelease.content)}
                </div>

                {featuredRelease.mediaUrls && featuredRelease.mediaUrls.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    {featuredRelease.mediaUrls.map((url, imgIdx) => (
                      <div 
                        key={imgIdx}
                        onClick={() => setLightboxImage(url)}
                        className="group/img relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-slate-950 cursor-pointer"
                      >
                        <img 
                          src={url} 
                          alt={`Update preview ${imgIdx + 1}`} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs text-slate-400">
                  <span>Published by <strong className="text-slate-200">{featuredRelease.authorName || 'StudentOS Team'}</strong></span>

                  {featuredRelease.actionUrl && onNavigateTab && (
                    <button
                      onClick={() => {
                        handleMarkAsRead(featuredRelease.id);
                        if (featuredRelease.actionUrl?.startsWith('http')) {
                          window.open(featuredRelease.actionUrl, '_blank', 'noopener,noreferrer');
                        } else if (onNavigateTab) {
                          onNavigateTab(featuredRelease.actionUrl!);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{featuredRelease.actionLabel || `Open ${featuredRelease.actionUrl.replace('_', ' ')}`}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* Chronological Release Entries */}
          <div className="space-y-4">
            {timelineUpdates.map((update, idx) => {
              const isRead = readIds.has(update.id);
              const cat = CATEGORY_CONFIG[update.category] || CATEGORY_CONFIG.feature;
              const isLong = (update.content || '').split('\n').length > 8;
              const isExpanded = expandedIds.has(update.id);
              const displayContent = isLong && !isExpanded
                ? update.content.split('\n').slice(0, 8).join('\n')
                : update.content;

              return (
                <motion.article
                  key={update.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.25) }}
                  onMouseEnter={() => { if (!isRead) handleMarkAsRead(update.id); }}
                  className="bento-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span className="font-mono font-bold text-white">{update.version}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${cat.badgeText}`}>{cat.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{formatDate(update.publishedAt)}</span>
                        {update.isMajorRelease && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-indigo-400 font-semibold">Major Update</span>
                          </>
                        )}
                        {!isRead && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-rose-400 font-bold">Unread</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base sm:text-xl font-extrabold text-white font-display tracking-tight">
                        {update.title}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      {!isRead ? (
                        <button
                          onClick={() => handleMarkAsRead(update.id)}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                        >
                          Mark as read
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Read
                        </span>
                      )}
                    </div>
                  </div>

                  {update.summary && (
                    <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                      {update.summary}
                    </p>
                  )}

                  <div>
                    {renderMarkdownContent(displayContent)}
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(update.id)}
                        className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        {isExpanded ? 'Show less' : 'Read full release notes →'}
                      </button>
                    )}
                  </div>

                  {update.mediaUrls && update.mediaUrls.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                      {update.mediaUrls.map((url, imgIdx) => (
                        <div 
                          key={imgIdx}
                          onClick={() => setLightboxImage(url)}
                          className="group/img relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-slate-950 cursor-pointer"
                        >
                          <img 
                            src={url} 
                            alt={`Preview ${imgIdx + 1}`} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs text-slate-400">
                    <span>Published by <strong className="text-slate-300">{update.authorName || 'StudentOS Team'}</strong></span>

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
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{update.actionLabel || `Open ${update.actionUrl.replace('_', ' ')}`}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
