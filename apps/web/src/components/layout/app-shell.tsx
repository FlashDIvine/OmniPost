'use client';

import React from 'react';
import { Header } from './header';

export interface AppShellProps {
  children: React.ReactNode;
  apiStatus?: 'online' | 'offline' | 'checking';
}

export function AppShell({ children, apiStatus = 'checking' }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
      <Header apiStatus={apiStatus} />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200/80 dark:border-zinc-800/80 py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>OmniPost &copy; 2026. All rights reserved.</span>
          <span className="font-mono text-[11px]">Phase 9.1 — Frontend Foundation</span>
        </div>
      </footer>
    </div>
  );
}
