import React from 'react';
import {
  ConnectionStatus,
  Platform,
  PostStatus,
  PublishAttemptStatus,
} from '../../types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'success'
    | 'warning'
    | 'error'
    | 'neutral'
    | 'info'
    | 'instagram'
    | 'tiktok';
  platform?: Platform;
  status?: PostStatus | ConnectionStatus | PublishAttemptStatus;
  size?: 'sm' | 'md';
}

export function Badge({
  className = '',
  variant = 'default',
  platform,
  status,
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  let resolvedVariant = variant;

  if (platform === Platform.INSTAGRAM) resolvedVariant = 'instagram';
  if (platform === Platform.TIKTOK) resolvedVariant = 'tiktok';

  if (status) {
    switch (status) {
      case PostStatus.PUBLISHED:
      case ConnectionStatus.CONNECTED:
      case PublishAttemptStatus.SUCCESS:
        resolvedVariant = 'success';
        break;
      case PostStatus.PUBLISHING:
      case PublishAttemptStatus.PENDING:
        resolvedVariant = 'info';
        break;
      case PostStatus.FAILED:
      case ConnectionStatus.EXPIRED:
      case PublishAttemptStatus.FAILED:
        resolvedVariant = 'error';
        break;
      case PostStatus.DRAFT:
      case ConnectionStatus.DISCONNECTED:
        resolvedVariant = 'neutral';
        break;
    }
  }

  const variantStyles = {
    default:
      'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    success:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    warning:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    error:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    neutral:
      'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
    info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    instagram:
      'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50',
    tiktok:
      'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 border-slate-700 dark:border-zinc-700',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px] font-medium',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border tracking-wide uppercase ${sizeStyles[size]} ${variantStyles[resolvedVariant]} ${className}`}
      {...props}
    >
      {children || platform || status}
    </span>
  );
}
