'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { apiClient } from '@/lib/api/client';
import { ConnectionStatus, PaginatedPostsResponse, Platform, Post, SocialAccount } from '@/types';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function DashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const [accRes, postRes] = await Promise.all([
          apiClient.get<SocialAccount[]>('/social-accounts'),
          apiClient.get<PaginatedPostsResponse>('/posts', { params: { limit: 5 } }),
        ]);
        setAccounts(accRes.data);
        setRecentPosts(postRes.data.data || []);
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
            <div className="flex items-center gap-3">
              <Link href="/dashboard/posts/new">
                <Button variant="primary" size="sm">
                  + Create Post
                </Button>
              </Link>
              <Link href="/dashboard/accounts">
                <Button variant="outline" size="sm">
                  Manage Accounts
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

          {/* Publishing Pipeline & Recent Posts Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Posts Card */}
            <Card className="lg:col-span-2" glass>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Posts</CardTitle>
                    <CardDescription>Latest publishing pipeline drafts and submissions</CardDescription>
                  </div>
                  <Link href="/dashboard/posts">
                    <Button variant="outline" size="sm">
                      View All Posts →
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="md" />
                  </div>
                ) : recentPosts.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      You haven&apos;t created any posts yet.
                    </p>
                    <Link href="/dashboard/posts/new">
                      <Button variant="primary" size="sm">
                        Create Your First Post
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {recentPosts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/dashboard/posts/${post.id}`}
                        className="flex items-center justify-between py-3.5 hover:bg-slate-50/50 dark:hover:bg-zinc-850/50 rounded-lg px-2 transition-colors"
                      >
                        <div className="space-y-1 min-w-0 pr-4">
                          <p className="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                            {post.caption || <span className="text-slate-400 italic">No caption</span>}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{post.media?.length || 0} media file(s)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {post.socialAccount && (
                            <Badge platform={post.socialAccount.platform} size="sm" />
                          )}
                          <Badge status={post.status} size="sm" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social Channels Summary Card */}
            <Card glass>
              <CardHeader>
                <CardTitle>Connected Channels</CardTitle>
                <CardDescription>Publishing destination status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-xs shadow-sm">
                      IG
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Instagram</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[100px]">
                        {instagramAccount ? `@${instagramAccount.username}` : 'Unlinked'}
                      </div>
                    </div>
                  </div>
                  <Badge
                    size="sm"
                    status={
                      instagramAccount ? instagramAccount.connectionStatus : ConnectionStatus.DISCONNECTED
                    }
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-zinc-800 text-white font-bold text-xs shadow-sm border border-slate-700">
                      TT
                    </div>
                    <div>
                      <div className="text-xs font-semibold">TikTok</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[100px]">
                        {tikTokAccount ? `@${tikTokAccount.username}` : 'Unlinked'}
                      </div>
                    </div>
                  </div>
                  <Badge
                    size="sm"
                    status={
                      tikTokAccount ? tikTokAccount.connectionStatus : ConnectionStatus.DISCONNECTED
                    }
                  />
                </div>

                <Link href="/dashboard/accounts" className="block pt-2">
                  <Button variant="outline" size="sm" className="w-full">
                    Configure Channels →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
