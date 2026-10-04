/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, X, Rocket } from 'lucide-react';
import { SystemUpdate, UserProfile, UserRole } from '../types';
import { 
  getPublishedUpdates, 
  getUserReadUpdateIds, 
  isMajorReleaseDismissed, 
  dismissMajorRelease 
} from '../lib/supabaseUpdates';

interface MajorReleaseBannerProps {
  currentUser: UserProfile | null;
  effectiveRole?: string;
  onNavigateTab: (tab: string) => void;
}

export function MajorReleaseBanner({
  currentUser,
  effectiveRole,
  onNavigateTab
}: MajorReleaseBannerProps) {
  const [activeMajorUpdate, setActiveMajorUpdate] = useState<SystemUpdate | null>(null);
  const [visible, setVisible] = useState<boolean>(false);

  const userId = currentUser?.uid || currentUser?.email || 'guest';
  const userRole = (effectiveRole as UserRole) || currentUser?.role || 'student';

  useEffect(() => {
    let isMounted = true;

    async function checkForMajorRelease() {
      try {
        const [updates, readIds] = await Promise.all([
          getPublishedUpdates(userRole),
          getUserReadUpdateIds(userId)
        ]);

        // Find the newest published major release
        const majorRelease = updates.find(u => 
          u.isMajorRelease && 
          u.status === 'published' &&
          (!u.publishedAt || new Date(u.publishedAt).getTime() <= Date.now())
        );

        if (!majorRelease) {
          if (isMounted) setVisible(false);
          return;
        }

        // Check if user has read it or dismissed it
        const isRead = readIds.has(majorRelease.id);
        const isDismissed = isMajorReleaseDismissed(userId, majorRelease.id);

        if (!isRead && !isDismissed) {
          if (isMounted) {
            setActiveMajorUpdate(majorRelease);
            setVisible(true);
          }
        } else {
          if (isMounted) setVisible(false);
        }
      } catch (err) {
        console.warn('Error checking for major release announcement:', err);
      }
    }

    checkForMajorRelease();

    // Recheck on publish events
    const handleWsPublish = () => checkForMajorRelease();
    window.addEventListener('studentos_whats_new_updated', handleWsPublish);
    return () => {
      isMounted = false;
      window.removeEventListener('studentos_whats_new_updated', handleWsPublish);
    };
  }, [userId, userRole]);

  if (!visible || !activeMajorUpdate) return null;

  const handleDismiss = () => {
    if (activeMajorUpdate) {
      dismissMajorRelease(userId, activeMajorUpdate.id);
    }
    setVisible(false);
  };

  const handleView = () => {
    handleDismiss();
    onNavigateTab('whats_new');
  };

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] animate-slideUp">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/40 p-4 sm:p-5 shadow-[0_10px_35px_-5px_rgba(79,70,229,0.35)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-lg shrink-0 shadow-md">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[9px] font-black uppercase tracking-wider">
                  Major Release
                </span>
                <span className="font-mono text-[10px] text-indigo-300 font-bold">
                  {activeMajorUpdate.version}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-snug">
                {activeMajorUpdate.title}
              </h4>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-300 mt-2 line-clamp-2 leading-relaxed">
          {activeMajorUpdate.summary || 'A new official StudentOS release has landed with major features and enhancements.'}
        </p>

        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/5">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-semibold"
          >
            Later
          </button>
          <button
            onClick={handleView}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>See What's New</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
