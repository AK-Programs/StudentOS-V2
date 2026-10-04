import React from 'react';
import { useAppEnvironment } from '../lib/appEnvironment';

export interface EnvironmentBadgeProps {
  className?: string;
  showIcon?: boolean;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({
  className = '',
  showIcon = true
}) => {
  const env = useAppEnvironment();

  const colorStyles = {
    default: 'bg-slate-800/80 text-slate-300 border-white/10',
    indigo: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-500/30'
  }[env.badgeVariant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorStyles} ${className}`}
      title={env.details}
    >
      {showIcon && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {env.badgeLabel}
    </span>
  );
};
