import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { clampContextMenuPosition } from '../../lib/useContextHoldMenu';
import { MOTION_EASE, MOTION_DURATION, useReducedMotionPreference } from '../../lib/motionSystem';

export interface NativeContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  menuWidth?: number;
  menuHeight?: number;
  ariaLabel: string;
  headerTitle?: string;
  headerSubtitle?: string;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  isInteractionGuarded?: () => boolean;
  onClose: () => void;
  className?: string;
  zIndexBackdrop?: number;
  zIndexMenu?: number;
  children: React.ReactNode;
}

export const NativeContextMenu: React.FC<NativeContextMenuProps> = ({
  isOpen,
  x,
  y,
  menuWidth = 224,
  menuHeight = 220,
  ariaLabel,
  headerTitle,
  headerSubtitle,
  menuRef,
  isInteractionGuarded,
  onClose,
  className = '',
  zIndexBackdrop = 219,
  zIndexMenu = 220,
  children,
}) => {
  const prefersReduced = useReducedMotionPreference();

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const pos = clampContextMenuPosition(x, y, menuWidth, menuHeight);

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: zIndexBackdrop }}
        onClick={() => {
          if (isInteractionGuarded?.()) return;
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <motion.div
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, scale: 0.94, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          prefersReduced
            ? { duration: 0.01 }
            : { duration: MOTION_DURATION.instant, ease: MOTION_EASE.easeOutExpo }
        }
        style={{
          left: pos.left,
          top: pos.top,
          zIndex: zIndexMenu,
          transformOrigin: 'top left',
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className={`fixed max-h-[80vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl p-1.5 ${className}`}
      >
        {(headerTitle || headerSubtitle) && (
          <div className="px-3 py-1.5 border-b border-white/5 mb-1">
            {headerTitle && (
              <p className="text-[11px] font-bold text-white truncate">{headerTitle}</p>
            )}
            {headerSubtitle && (
              <p className="text-[10px] text-slate-400 truncate capitalize">{headerSubtitle}</p>
            )}
          </div>
        )}
        {children}
      </motion.div>
    </>,
    document.body
  );
};
