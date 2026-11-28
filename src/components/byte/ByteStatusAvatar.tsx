/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Byte Assistant Visual State Indicator
 * - Grounded in VeylentraIcon geometric identity for ready/input/generating states
 * - Driven strictly by real assistant execution states
 * - GPU-composited transforms (transform, opacity) & full prefers-reduced-motion compliance
 */

import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, Cpu, Globe, PenLine } from 'lucide-react';
import { VeylentraIcon } from '../ui/VeylentraIcon';
import { useReducedMotionPreference } from '../../lib/motionSystem';

export type ByteAssistantState =
  | 'ready'
  | 'receiving_input'
  | 'thinking'
  | 'generating'
  | 'operating'
  | 'finished'
  | 'error';

export const BYTE_STATE_LABELS: Record<ByteAssistantState, string> = {
  ready: 'Ready',
  receiving_input: 'Composing',
  thinking: 'Analyzing Context',
  generating: 'Streaming Response',
  operating: 'Verifying Sources',
  finished: 'Response Complete',
  error: 'Attention Needed'
};

interface ByteStatusAvatarProps {
  state: ByteAssistantState;
  size?: 'sm' | 'md' | 'lg';
}

export const ByteStatusAvatar: React.FC<ByteStatusAvatarProps> = ({ state, size = 'md' }) => {
  const reduced = useReducedMotionPreference();

  const dimensions =
    size === 'sm' ? 'w-8 h-8 rounded-xl' : size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-10 h-10 rounded-xl';
  const glyphSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-4.5 h-4.5';
  const veylentraSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;

  const toneClasses: Record<ByteAssistantState, string> = {
    ready: 'bg-indigo-500/12 border-indigo-500/35 text-indigo-300',
    receiving_input: 'bg-sky-500/15 border-sky-400/45 text-sky-300',
    thinking: 'bg-violet-500/20 border-violet-400/50 text-violet-200',
    generating: 'bg-indigo-500/20 border-indigo-400/55 text-indigo-200',
    operating: 'bg-teal-500/20 border-teal-400/50 text-teal-200',
    finished: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300',
    error: 'bg-rose-500/15 border-rose-400/45 text-rose-300'
  };

  const renderGlyph = () => {
    if (state === 'error') return <AlertCircle className={glyphSize} />;
    if (state === 'finished') return <Check className={glyphSize} />;
    if (state === 'operating') return <Globe className={glyphSize} />;
    if (state === 'thinking') return <Cpu className={glyphSize} />;
    if (state === 'receiving_input') return <PenLine className={glyphSize} />;
    return <VeylentraIcon name="byte" size={veylentraSize} />;
  };

  const isActive = state === 'thinking' || state === 'generating' || state === 'operating';

  return (
    <div
      className={`relative inline-flex items-center justify-center border shrink-0 transition-colors ${dimensions} ${toneClasses[state]}`}
      aria-label={`Byte state: ${BYTE_STATE_LABELS[state]}`}
    >
      {!reduced && isActive && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-[inherit] border border-current opacity-40 pointer-events-none"
          initial={{ scale: 0.96, opacity: 0.4 }}
          animate={{ scale: [0.98, 1.14, 0.98], opacity: [0.42, 0.1, 0.42] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <motion.span
        className="relative flex items-center justify-center"
        animate={
          reduced
            ? undefined
            : state === 'thinking'
              ? { rotate: [0, 8, -8, 0] }
              : state === 'generating'
                ? { scale: [1, 1.06, 1] }
                : state === 'finished'
                  ? { scale: [0.92, 1.06, 1] }
                  : { scale: 1, rotate: 0 }
        }
        transition={
          state === 'thinking' || state === 'generating'
            ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
      >
        {renderGlyph()}
      </motion.span>
    </div>
  );
};
