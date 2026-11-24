import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface ContextHoldMenuState<TId = string> {
  itemId: TId;
  x: number;
  y: number;
  openedViaHold?: boolean;
}

export interface ClampedMenuPosition {
  left: number;
  top: number;
}

/**
 * Clamp floating contextual menu coordinates cleanly inside viewport bounds.
 */
export function clampContextMenuPosition(
  x: number,
  y: number,
  menuWidth: number = 216,
  menuHeight: number = 240,
  viewportWidth?: number,
  viewportHeight?: number,
  margin: number = 8
): ClampedMenuPosition {
  const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 768);

  const safeMaxLeft = Math.max(margin, vw - menuWidth - margin);
  const safeMaxTop = Math.max(margin, vh - menuHeight - margin);

  const left = Math.max(margin, Math.min(Number.isFinite(x) ? x : margin, safeMaxLeft));
  const top = Math.max(margin, Math.min(Number.isFinite(y) ? y : margin, safeMaxTop));

  return { left, top };
}

/**
 * Check if pointer/touch moved further than scroll-cancellation threshold.
 */
export function didPointerMoveExceedThreshold(
  startX: number,
  startY: number,
  currX: number,
  currY: number,
  thresholdPx: number = 10
): boolean {
  const dx = currX - startX;
  const dy = currY - startY;
  return Math.hypot(dx, dy) > thresholdPx;
}

/**
 * Skip starting long-press if user pressed an inner button, link, or input control.
 */
export function shouldIgnoreHoldStartTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).closest !== 'function') return false;
  return Boolean(
    (target as HTMLElement).closest('button, a, input, textarea, select, [data-no-context-menu="true"]')
  );
}

/**
 * Prevents the finger-lift synthetic mousedown/click immediately following a mobile long-press
 * from dismissing the newly opened contextual menu or firing item #1 underneath the finger.
 */
export function shouldBlockPostHoldInteraction(
  holdActive: boolean,
  graceUntilMs: number,
  nowMs: number = Date.now()
): boolean {
  return holdActive || nowMs < graceUntilMs;
}

export interface UseContextHoldMenuOptions<TId = string> {
  holdDelayMs?: number;
  moveThresholdPx?: number;
  onOpen?: (state: ContextHoldMenuState<TId>) => void;
}

export interface ContextHoldBindProps {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Unified mobile long-press + desktop right-click handler.
 * - Suppresses native browser context menu ONLY on bound items
 * - Cancels hold cleanly if pointer/finger scrolls (>10px)
 * - Suppresses trailing short-tap onClick after a long-press triggers
 */
export function useContextHoldMenu<TId = string>(
  options?: UseContextHoldMenuOptions<TId>
) {
  const holdDelayMs = options?.holdDelayMs ?? 480;
  const moveThresholdPx = options?.moveThresholdPx ?? 10;
  const onOpenRef = useRef(options?.onOpen);
  onOpenRef.current = options?.onOpen;

  const [menu, setMenu] = useState<ContextHoldMenuState<TId> | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ itemId: TId; x: number; y: number } | null>(null);
  const suppressedClickRef = useRef<{ itemId: TId; expiresAt: number } | null>(null);
  const lastTimerOpenedRef = useRef<{ itemId: TId; openedAt: number } | null>(null);
  const holdActiveRef = useRef<boolean>(false);
  const interactionGraceUntilRef = useRef<number>(0);

  const clearHoldTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pointerStartRef.current = null;
  }, []);

  const isInteractionGuarded = useCallback((): boolean => {
    return shouldBlockPostHoldInteraction(holdActiveRef.current, interactionGraceUntilRef.current);
  }, []);

  const armPostHoldReleaseGuard = useCallback(() => {
    holdActiveRef.current = true;
    interactionGraceUntilRef.current = Date.now() + 2500;

    if (typeof window === 'undefined') return;
    const handleRelease = () => {
      holdActiveRef.current = false;
      interactionGraceUntilRef.current = Date.now() + 420;
      window.removeEventListener('touchend', handleRelease, true);
      window.removeEventListener('touchcancel', handleRelease, true);
      window.removeEventListener('mouseup', handleRelease, true);
    };
    window.addEventListener('touchend', handleRelease, true);
    window.addEventListener('touchcancel', handleRelease, true);
    window.addEventListener('mouseup', handleRelease, true);
  }, []);

  const openMenu = useCallback((itemId: TId, x: number, y: number, fromHoldTimer = false) => {
    const nextState: ContextHoldMenuState<TId> = { itemId, x, y, openedViaHold: fromHoldTimer };
    if (fromHoldTimer) {
      lastTimerOpenedRef.current = { itemId, openedAt: Date.now() };
      armPostHoldReleaseGuard();
    } else {
      holdActiveRef.current = false;
      interactionGraceUntilRef.current = 0;
    }
    suppressedClickRef.current = { itemId, expiresAt: Date.now() + 850 };
    if (fromHoldTimer && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(12);
      } catch (_) {}
    }
    setMenu(nextState);
    onOpenRef.current?.(nextState);
  }, [armPostHoldReleaseGuard]);

  const closeMenu = useCallback(() => {
    clearHoldTimer();
    holdActiveRef.current = false;
    interactionGraceUntilRef.current = 0;
    setMenu(null);
  }, [clearHoldTimer]);

  /**
   * Call inside the row's onClick handler.
   * Returns true if the tap immediately follows a long-press/context trigger (meaning onClick must NOT open/select the item).
   */
  const shouldSuppressClick = useCallback((itemId?: TId): boolean => {
    const suppressed = suppressedClickRef.current;
    if (!suppressed) return false;
    if (Date.now() > suppressed.expiresAt) {
      suppressedClickRef.current = null;
      return false;
    }
    if (itemId !== undefined && suppressed.itemId !== itemId) {
      return false;
    }
    suppressedClickRef.current = null;
    return true;
  }, []);

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, [clearHoldTimer]);

  const startHold = useCallback(
    (itemId: TId, x: number, y: number) => {
      clearHoldTimer();
      pointerStartRef.current = { itemId, x, y };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        pointerStartRef.current = null;
        openMenu(itemId, x, y, true);
      }, holdDelayMs);
    },
    [clearHoldTimer, holdDelayMs, openMenu]
  );

  const getItemBindProps = useCallback(
    (itemId: TId): ContextHoldBindProps => ({
      onTouchStart: (e) => {
        if (e.touches.length !== 1) {
          clearHoldTimer();
          return;
        }
        if (shouldIgnoreHoldStartTarget(e.target)) return;
        const touch = e.touches[0];
        startHold(itemId, touch.clientX, touch.clientY);
      },
      onTouchMove: (e) => {
        const start = pointerStartRef.current;
        if (!start || e.touches.length === 0) return;
        const touch = e.touches[0];
        if (didPointerMoveExceedThreshold(start.x, start.y, touch.clientX, touch.clientY, moveThresholdPx)) {
          clearHoldTimer();
        }
      },
      onTouchEnd: () => {
        if (timerRef.current !== null) {
          clearHoldTimer();
        }
        if (holdActiveRef.current) {
          holdActiveRef.current = false;
          interactionGraceUntilRef.current = Date.now() + 420;
        }
      },
      onTouchCancel: () => {
        clearHoldTimer();
        if (holdActiveRef.current) {
          holdActiveRef.current = false;
          interactionGraceUntilRef.current = Date.now() + 420;
        }
      },
      onMouseDown: (e) => {
        // Right-click is handled cleanly via onContextMenu; ignore non-primary mouse buttons here.
        if (e.button !== 0) return;
        if (shouldIgnoreHoldStartTarget(e.target)) return;
        startHold(itemId, e.clientX, e.clientY);
      },
      onMouseMove: (e) => {
        const start = pointerStartRef.current;
        if (!start) return;
        if (didPointerMoveExceedThreshold(start.x, start.y, e.clientX, e.clientY, moveThresholdPx)) {
          clearHoldTimer();
        }
      },
      onMouseUp: () => {
        clearHoldTimer();
        if (holdActiveRef.current) {
          holdActiveRef.current = false;
          interactionGraceUntilRef.current = Date.now() + 420;
        }
      },
      onMouseLeave: () => {
        clearHoldTimer();
      },
      onContextMenu: (e) => {
        if (shouldIgnoreHoldStartTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();

        // Check if long-press timer already opened this exact menu right before Chrome emitted contextmenu
        const lastOpened = lastTimerOpenedRef.current;
        if (lastOpened && lastOpened.itemId === itemId && Date.now() - lastOpened.openedAt < 900) {
          clearHoldTimer();
          return;
        }

        const fallbackStart = pointerStartRef.current;
        clearHoldTimer();
        const x = e.clientX || fallbackStart?.x || 24;
        const y = e.clientY || fallbackStart?.y || 24;
        openMenu(itemId, x, y, false);
      },
    }),
    [clearHoldTimer, moveThresholdPx, openMenu, startHold]
  );

  return {
    menu,
    setMenu,
    openMenu,
    closeMenu,
    shouldSuppressClick,
    isInteractionGuarded,
    getItemBindProps,
  };
}

/**
 * Dismiss floating context menus on Escape, scroll outside the menu, resize, or outside pointer press.
 */
export function useDismissContextMenu(
  isOpen: boolean,
  onClose: () => void,
  menuRef?: React.RefObject<HTMLElement | null>,
  isInteractionGuarded?: () => boolean
) {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleOutsidePointer = (e: MouseEvent | TouchEvent) => {
      if (e.type === 'mousedown' && isInteractionGuarded?.()) {
        return;
      }
      const target = e.target as Node | null;
      if (menuRef?.current && target && menuRef.current.contains(target)) {
        return;
      }
      onClose();
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (menuRef?.current && target && menuRef.current.contains(target)) {
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    document.addEventListener('mousedown', handleOutsidePointer, true);
    document.addEventListener('touchstart', handleOutsidePointer, { capture: true, passive: true });
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('mousedown', handleOutsidePointer, true);
      document.removeEventListener('touchstart', handleOutsidePointer, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onClose, menuRef, isInteractionGuarded]);
}
