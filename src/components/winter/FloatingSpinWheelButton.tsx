/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistent Floating Spin Wheel Launcher
 * Positioned cleanly above Byte (bottom-24 right-5) so floating helpers never overlap.
 * Displays compact ready indicator or dimmed 2-hour countdown, and notifies once per ready cycle.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { UserProfile } from '../../types';
import { useFeatureAccess } from '../../lib/featureAccessService';
import {
  fetchWinterStatus,
  formatCountdownMs,
  markWheelCycleNotified,
  WinterStatusResponse,
} from '../../lib/winterFestivalService';
import { SpinWheelModal } from './SpinWheelModal';

interface FloatingSpinWheelButtonProps {
  currentUser: UserProfile;
  showNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const FloatingSpinWheelButton: React.FC<FloatingSpinWheelButtonProps> = ({
  currentUser,
  showNotification,
}) => {
  const prefersReduced = useReducedMotion();
  const spinAccess = useFeatureAccess('winter_spin_wheel', currentUser);
  const [winterStatus, setWinterStatus] = useState<WinterStatusResponse | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const loadStatus = useCallback(async () => {
    if (!spinAccess.accessible || !currentUser?.uid) return;
    const status = await fetchWinterStatus(currentUser);
    if (status) {
      setWinterStatus(status);
      setRemainingMs(status.spinWheel?.remainingMs || 0);
    }
  }, [spinAccess.accessible, currentUser]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const onRefresh = () => {
      loadStatus();
    };
    window.addEventListener('veylentra-winter-updated', onRefresh);
    return () => window.removeEventListener('veylentra-winter-updated', onRefresh);
  }, [loadStatus]);

  useEffect(() => {
    const nextIso = winterStatus?.spinWheel?.nextEligibleAt;
    if (!nextIso) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      setRemainingMs(Math.max(0, Date.parse(nextIso) - Date.now()));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [winterStatus?.spinWheel?.nextEligibleAt]);

  useEffect(() => {
    if (!spinAccess.accessible || !winterStatus?.spinWheel?.canSpin) return;
    const cycleKey = winterStatus.spinWheel.nextEligibleAt || 'initial_ready';
    if (winterStatus.spinWheel.lastWheelNotifiedCycle === cycleKey) return;

    const storageKey = `veylentra_wheel_notified_${currentUser.uid}_${cycleKey}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, '1');
    } catch (_) {}

    markWheelCycleNotified(currentUser, cycleKey);
    showNotification?.('Winter Spin Wheel is ready for your next reward!', 'info');
  }, [spinAccess.accessible, winterStatus, currentUser, showNotification]);

  if (!spinAccess.accessible) {
    return null;
  }

  const isReady = remainingMs <= 0;

  return (
    <>
      <div className="fixed bottom-24 right-5 z-40">
        <motion.button
          type="button"
          onClick={() => {
            loadStatus();
            setModalOpen(true);
          }}
          whileHover={prefersReduced ? undefined : { scale: 1.04 }}
          whileTap={prefersReduced ? undefined : { scale: 0.96 }}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-lg backdrop-blur-md transition-all cursor-pointer ${
            isReady
              ? 'bg-slate-900/95 border-sky-400/60 text-white shadow-sky-500/20'
              : 'bg-slate-900/80 border-slate-700/80 text-slate-300 opacity-75 hover:opacity-100'
          }`}
          aria-label={isReady ? 'Open Winter Spin Wheel (Ready)' : `Winter Spin Wheel cooldown ${formatCountdownMs(remainingMs)}`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            className={isReady && !prefersReduced ? 'animate-spin' : ''}
            style={isReady && !prefersReduced ? { animationDuration: '9s' } : undefined}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M12 2A10 10 0 0 1 22 12H12Z" fill="#0284c7" />
            <path d="M22 12A10 10 0 0 1 12 22V12Z" fill="#059669" />
            <path d="M12 22A10 10 0 0 1 2 12H12Z" fill="#d97706" />
            <path d="M2 12A10 10 0 0 1 12 2V12Z" fill="#dc2626" />
            <circle cx="12" cy="12" r="3" fill="#f8fafc" />
          </svg>

          <div className="text-left leading-tight">
            <p className="text-[11px] font-bold whitespace-nowrap">
              {isReady ? 'Winter Wheel Ready' : 'Wheel Cooldown'}
            </p>
            <p className="text-[10px] font-mono tabular-nums text-sky-300 whitespace-nowrap">
              {isReady ? 'Tap to Spin' : formatCountdownMs(remainingMs)}
            </p>
          </div>
        </motion.button>
      </div>

      <SpinWheelModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUser={currentUser}
        winterStatus={winterStatus}
        onSpinComplete={loadStatus}
        isPreviewOnly={spinAccess.isPreviewOnly}
      />
    </>
  );
};
