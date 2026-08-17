'use client';

import React from 'react';
import { useAuth } from '../../lib/auth/auth-context';

export interface HeaderProps {
  apiStatus?: 'online' | 'offline' | 'checking';
}

export function Header({ apiStatus = 'checking' }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 text-white shadow-md shadow-indigo-500/20 font-bold text-lg">
              O
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white tracking-tight text-base">
                OmniPost
              </span>
              <span className="ml-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                Social Hub
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-zinc-800">
            <span className="relative flex h-2 w-2">
              {apiStatus === 'online' && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  apiStatus === 'online'
                    ? 'bg-emerald-500'
                    : apiStatus === 'offline'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              API {apiStatus}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium text-xs">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium hidden sm:inline">{user.username}</span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-400 dark:text-zinc-500">
              Foundation Mode (Phase 9.1)
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
