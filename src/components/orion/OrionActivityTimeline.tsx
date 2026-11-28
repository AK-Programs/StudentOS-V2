import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { OrionAgentProgressSnapshot } from '../../lib/orionAgentEngine';
import { useReducedMotionPreference } from '../../lib/motionSystem';

interface OrionActivityTimelineProps {
  snapshot: OrionAgentProgressSnapshot | null;
}

function formatDurationMs(ms?: number): string {
  if (ms === undefined || Number.isNaN(ms)) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const OrionActivityTimeline: React.FC<OrionActivityTimelineProps> = ({ snapshot }) => {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useReducedMotionPreference();

  if (!snapshot) return null;

  const isFailed = snapshot.phase === 'failed';
  const isWaiting = snapshot.phase === 'awaiting_confirmation';
  const isClarifying = snapshot.phase === 'clarifying';
  const isDone = snapshot.phase === 'completed';

  const totalDuration =
    snapshot.finishedAt !== undefined
      ? Math.max(1, snapshot.finishedAt - snapshot.startedAt)
      : undefined;

  const surfaceTone = isFailed
    ? 'border-rose-500/30 bg-rose-950/20'
    : isWaiting || isClarifying
    ? 'border-amber-500/30 bg-amber-950/15'
    : isDone
    ? 'border-emerald-500/25 bg-emerald-950/15'
    : 'border-indigo-500/30 bg-slate-950/75';

  const autoShowSteps = isFailed || expanded;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border p-3.5 transition-colors duration-200 ${surfaceTone}`}
      role="status"
      aria-live="polite"
    >
      {/* Top Status Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {isFailed ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : isWaiting ? (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          ) : isClarifying ? (
            <HelpCircle className="w-4 h-4 text-amber-300 shrink-0" />
          ) : isDone ? (
            snapshot.verified ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )
          ) : (
            <Loader2
              className={`w-4 h-4 text-indigo-400 shrink-0 ${reducedMotion ? '' : 'animate-spin'}`}
            />
          )}

          <div className="min-w-0 flex items-center gap-2">
            <span className="text-xs font-semibold text-white truncate">{snapshot.headline}</span>
            {snapshot.verified && isDone && (
              <span className="text-[11px] font-medium text-emerald-300">· Verified</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {totalDuration !== undefined && (
            <span className="text-[11px] font-mono tabular-nums text-slate-400 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDurationMs(totalDuration)}
            </span>
          )}
          {snapshot.steps.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-medium text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 inline-flex items-center gap-1 transition-colors"
            >
              <span>{autoShowSteps ? 'Hide steps' : `Steps (${snapshot.steps.length})`}</span>
              {autoShowSteps ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Stage Stepper */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {snapshot.stages.map((stage, idx) => {
          const itemTone =
            stage.status === 'failed'
              ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
              : stage.status === 'completed'
              ? 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10'
              : stage.status === 'active'
              ? 'text-indigo-200 border-indigo-400/40 bg-indigo-500/15'
              : 'text-slate-400 border-white/10 bg-slate-950/40';

          return (
            <div
              key={`${stage.phase}-${idx}`}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium ${itemTone}`}
            >
              {stage.status === 'completed' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : stage.status === 'failed' ? (
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
              ) : stage.status === 'active' ? (
                <Loader2
                  className={`w-3 h-3 text-indigo-300 shrink-0 ${reducedMotion ? '' : 'animate-spin'}`}
                />
              ) : null}
              <span>{stage.label}</span>
              {stage.durationMs !== undefined && (
                <span className="font-mono text-[10px] opacity-75 tabular-nums">
                  {formatDurationMs(stage.durationMs)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Vertical Step Verification Rail */}
      {autoShowSteps && snapshot.steps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          {snapshot.steps.map((step, index) => {
            const isStepGood = step.status === 'verified' || step.status === 'completed';
            const isStepBad = step.status === 'failed' || step.status === 'blocked';

            return (
              <div
                key={step.id || index}
                className="flex items-start justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-slate-950/60 border border-white/5"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {isStepGood ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  ) : isStepBad ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 capitalize">{step.label}</div>
                    {(step.verificationNote || step.detail) && (
                      <div className="text-[11px] text-slate-400 mt-0.5 break-words">
                        {step.verificationNote || step.detail}
                      </div>
                    )}
                    {step.recordId && (
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Record ID: {step.recordId}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {step.durationMs !== undefined && (
                    <span className="text-[10px] font-mono tabular-nums text-slate-500">
                      {formatDurationMs(step.durationMs)}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-mono uppercase ${
                      isStepGood
                        ? 'text-emerald-300'
                        : isStepBad
                        ? 'text-rose-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
