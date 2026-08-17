'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export interface HeaderProps {
  apiStatus?: 'online' | 'offline' | 'checking';
}

export function Header({ apiStatus = 'checking' }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  const navLinks = isAuthenticated
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/dashboard/posts', label: 'Posts' },
        { href: '/dashboard/accounts', label: 'Social Accounts' },
      ]
    : [
        { href: '/', label: 'Overview' },
        { href: '/login', label: 'Sign in' },
        { href: '/register', label: 'Register' },
      ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Nav */}
        <div className="flex items-center gap-8">
          <Link href={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 text-white shadow-md shadow-indigo-500/20 font-bold text-lg transition-transform group-hover:scale-105">
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
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Status & Auth Area */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-zinc-800">
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

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-slate-200/60 dark:border-zinc-800">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-xs hidden sm:inline">{user.username}</span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors px-2 py-1"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
