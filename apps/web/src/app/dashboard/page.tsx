'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api/client';
import { ConnectionStatus, Platform, SocialAccount } from '@/types';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function DashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<SocialAccount[]>('/social-accounts');
        setAccounts(res.data);
      } catch {
        // Handled silently for dashboard summary
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const instagramAccount = accounts.find((a) => a.platform === Platform.INSTAGRAM);
  const tikTokAccount = accounts.find((a) => a.platform === Platform.TIKTOK);

  const connectedCount = accounts.filter(
    (a) => a.connectionStatus === ConnectionStatus.CONNECTED,
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8">
          {/* Welcome Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-zinc-800/60">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Welcome back, <span className="font-semibold text-slate-900 dark:text-zinc-100">{user?.username}</span>. Manage your social channels and publishing pipeline.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/accounts">
                <Button variant="primary" size="sm">
                  Manage Social Accounts
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Connected Channels</CardDescription>
                <CardTitle className="text-3xl font-extrabold mt-1">
                  {isLoading ? <Spinner size="sm" /> : `${connectedCount} / 2`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  Instagram & TikTok integrations
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Instagram Status</CardDescription>
                <CardTitle className="text-xl font-bold mt-1 flex items-center gap-2">
                  {isLoading ? (
                    <Spinner size="sm" />
                  ) : instagramAccount ? (
                    <>
                      <Badge variant="instagram">Connected</Badge>
                      <span className="text-sm font-normal text-slate-600 dark:text-zinc-300 truncate max-w-[120px]">
                        @{instagramAccount.username}
                      </span>
                    </>
                  ) : (
                    <Badge variant="neutral">Not Linked</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  Direct Publishing & Carousel Support
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>TikTok Status</CardDescription>
                <CardTitle className="text-xl font-bold mt-1 flex items-center gap-2">
                  {isLoading ? (
                    <Spinner size="sm" />
                  ) : tikTokAccount ? (
                    <>
                      <Badge variant="tiktok">Connected</Badge>
                      <span className="text-sm font-normal text-slate-600 dark:text-zinc-300 truncate max-w-[120px]">
                        @{tikTokAccount.username}
                      </span>
                    </>
                  ) : (
                    <Badge variant="neutral">Not Linked</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  Direct Post Video & Photo Support
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Social Channels Quick Action Card */}
          <Card glass>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Channel Hub</CardTitle>
                  <CardDescription>
                    Connect your professional social media accounts to enable multi-platform publishing
                  </CardDescription>
                </div>
                <Link href="/dashboard/accounts">
                  <Button variant="outline" size="sm">
                    View Channel Hub →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-lg shadow-sm">
                      IG
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Instagram Professional</div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {instagramAccount ? `@${instagramAccount.username}` : 'No account linked'}
                      </div>
                    </div>
                  </div>
                  <Badge
                    status={
                      instagramAccount ? instagramAccount.connectionStatus : ConnectionStatus.DISCONNECTED
                    }
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 dark:bg-zinc-800 text-white font-bold text-lg shadow-sm border border-slate-700">
                      TT
                    </div>
                    <div>
                      <div className="text-sm font-semibold">TikTok Direct Post</div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {tikTokAccount ? `@${tikTokAccount.username}` : 'No account linked'}
                      </div>
                    </div>
                  </div>
                  <Badge
                    status={
                      tikTokAccount ? tikTokAccount.connectionStatus : ConnectionStatus.DISCONNECTED
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
