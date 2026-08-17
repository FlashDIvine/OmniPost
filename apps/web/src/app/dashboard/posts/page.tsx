'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { PaginatedPostsResponse, Post, PostStatus } from '@/types';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: 10,
      };
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }

      const res = await apiClient.get<PaginatedPostsResponse>('/posts', { params });
      setPosts(res.data.data || []);
      setMeta(res.data.meta || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load posts';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedStatus]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiClient.delete(`/posts/${postToDelete.id}`);
      setPostToDelete(null);
      await fetchPosts();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to delete post';
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const statusFilters = ['ALL', 'DRAFT', 'PUBLISHING', 'PUBLISHED', 'FAILED'];

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-zinc-800/60">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
                Posts
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Manage, draft, publish, and track all your multi-platform social media posts
              </p>
            </div>
            <Link href="/dashboard/posts/new">
              <Button variant="primary" size="sm">
                + Create Post
              </Button>
            </Link>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="error" title="Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {statusFilters.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setSelectedStatus(status);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  selectedStatus === status
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Posts List */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              title={
                selectedStatus === 'ALL'
                  ? 'No posts created yet'
                  : `No posts in ${selectedStatus} status`
              }
              description="Start drafting a new post to publish across Instagram or TikTok."
              action={
                <Link href="/dashboard/posts/new">
                  <Button variant="primary" size="sm">
                    Create New Post
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id} className="hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {post.socialAccount && (
                          <Badge platform={post.socialAccount.platform} size="sm" />
                        )}
                        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          @{post.socialAccount?.username || 'Unknown account'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-400">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={post.status} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-800 dark:text-zinc-200 line-clamp-2">
                      {post.caption || <span className="text-slate-400 italic">No caption provided</span>}
                    </p>

                    {/* Media Asset Summary & Footer Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {post.media?.length || 0} attached media file(s)
                        </span>
                        {post.publishedAt && (
                          <>
                            <span>•</span>
                            <span>Published {new Date(post.publishedAt).toLocaleTimeString()}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {post.publishedUrl && (
                          <a
                            href={post.publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          >
                            <span>View Live</span>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}

                        <Link href={`/dashboard/posts/${post.id}`}>
                          <Button size="sm" variant={post.status === PostStatus.DRAFT ? 'primary' : 'outline'}>
                            {post.status === PostStatus.DRAFT
                              ? 'Edit & Publish'
                              : post.status === PostStatus.FAILED
                                ? 'View & Retry'
                                : 'View Details'}
                          </Button>
                        </Link>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                          onClick={() => setPostToDelete(post)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-zinc-800">
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                Showing page <span className="font-semibold">{meta.page}</span> of{' '}
                <span className="font-semibold">{meta.totalPages}</span> ({meta.total} total posts)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= meta.totalPages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={Boolean(postToDelete)}
            onClose={() => setPostToDelete(null)}
            title="Delete Post"
            description="Are you sure you want to delete this post?"
            footer={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPostToDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeletePost}
                  isLoading={isDeleting}
                >
                  Confirm Delete
                </Button>
              </>
            }
          >
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              This action cannot be undone. All associated media files and publishing logs for this post will be permanently removed.
            </p>
          </Modal>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
