import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
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
  const isDone = snapshot.phase === 'completed';

  const totalDuration =
    snapshot.finishedAt !== undefined
      ? Math.max(1, snapshot.finishedAt - snapshot.startedAt)
      : undefined;

  const headerTone = isFailed
    ? 'border-rose-500/35 bg-rose-950/20'
    : isWaiting
    ? 'border-amber-500/35 bg-amber-950/20'
    : isDone
    ? 'border-emerald-500/30 bg-emerald-950/15'
    : 'border-indigo-500/30 bg-slate-900/80';

  return (
    <div
      className={`rounded-2xl border p-3.5 shadow-lg transition-colors duration-200 ${headerTone}`}
      role="status"
      aria-live="polite"
    >
      {/* Top Status Strip */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {isFailed ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : isWaiting ? (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
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

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate">{snapshot.headline}</span>
              {snapshot.verified && isDone && (
                <span className="text-[10px] font-semibold text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 shrink-0">
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {totalDuration !== undefined && (
            <span className="text-[11px] font-mono tabular-nums text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDurationMs(totalDuration)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 flex items-center gap-1 transition-colors"
          >
            <span>{expanded ? 'Hide details' : 'View steps'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Stage Progression Row (No fake progress %) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {snapshot.stages.map((stage) => {
          const pillTone =
            stage.status === 'failed'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              : stage.status === 'completed'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : stage.status === 'active'
              ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200'
              : 'border-white/10 bg-slate-950/40 text-slate-400';

          return (
            <span
              key={stage.phase}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-medium ${pillTone}`}
            >
              {stage.status === 'active' && !reducedMotion && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              )}
              <span>{stage.label}</span>
              {stage.durationMs !== undefined && (
                <span className="font-mono text-[10px] opacity-75 tabular-nums">
                  {formatDurationMs(stage.durationMs)}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Collapsible Step Verification Breakdown */}
      {expanded && snapshot.steps.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
          {snapshot.steps.map((step) => {
            const statusTone =
              step.status === 'verified' || step.status === 'completed'
                ? 'text-emerald-300'
                : step.status === 'failed' || step.status === 'blocked'
                ? 'text-rose-300'
                : step.status === 'running'
                ? 'text-indigo-300'
                : 'text-slate-400';

            return (
              <div
                key={step.id}
                className="flex items-start justify-between gap-2 text-xs px-2.5 py-1.5 rounded-xl bg-slate-950/50 border border-white/5"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-200">{step.label}</div>
                  {(step.verificationNote || step.detail) && (
                    <div className="text-[11px] text-slate-400 mt-0.5 break-words">
                      {step.verificationNote || step.detail}
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-mono uppercase shrink-0 ${statusTone}`}>
                  {step.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
