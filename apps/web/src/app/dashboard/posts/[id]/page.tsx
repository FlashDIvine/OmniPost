'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { config } from '@/lib/config';
import { Media, Post, PostStatus, PublishAttempt } from '@/types';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [attempts, setAttempts] = useState<PublishAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit caption state
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);

  // Action loading states
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPostDetails = useCallback(async () => {
    if (!postId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [postRes, attemptsRes] = await Promise.all([
        apiClient.get<Post>(`/posts/${postId}`),
        apiClient.get<PublishAttempt[]>(`/posts/${postId}/attempts`),
      ]);
      setPost(postRes.data);
      setEditCaption(postRes.data.caption || '');
      setAttempts(attemptsRes.data || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load post details';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPostDetails();
  }, [fetchPostDetails]);

  // Handle caption update
  const handleUpdateCaption = async () => {
    setIsSavingCaption(true);
    setError(null);
    try {
      const res = await apiClient.patch<Post>(`/posts/${postId}`, {
        caption: editCaption.trim() || undefined,
      });
      setPost(res.data);
      setIsEditing(false);
      setSuccessMessage('Caption updated successfully.');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to update caption';
      setError(message);
    } finally {
      setIsSavingCaption(false);
    }
  };

  // Handle media file addition
  const handleAddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setIsUploadingMedia(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.upload<Media>(`/posts/${postId}/media`, formData);
      await fetchPostDetails();
      setSuccessMessage('Media attached successfully.');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to upload media';
      setError(message);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Handle media file deletion
  const handleDeleteMedia = async (mediaId: string) => {
    setError(null);
    try {
      await apiClient.delete(`/posts/${postId}/media/${mediaId}`);
      await fetchPostDetails();
      setSuccessMessage('Media asset removed.');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to delete media';
      setError(message);
    }
  };

  // Trigger publish
  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.post(`/posts/${postId}/publish`);
      await fetchPostDetails();
      setSuccessMessage('Post published successfully!');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Publishing failed. Check attempt logs below.';
      setError(message);
      await fetchPostDetails();
    } finally {
      setIsPublishing(false);
    }
  };

  // Trigger retry
  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.post(`/posts/${postId}/retry`);
      await fetchPostDetails();
      setSuccessMessage('Retry executed successfully!');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Retry publishing failed.';
      setError(message);
      await fetchPostDetails();
    } finally {
      setIsRetrying(false);
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await apiClient.delete(`/posts/${postId}`);
      router.push('/dashboard/posts');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to delete post';
      setError(message);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="flex min-h-[60vh] justify-center items-center">
            <Spinner size="lg" />
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (!post) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="text-center py-16 space-y-4">
            <h2 className="text-xl font-bold">Post Not Found</h2>
            <p className="text-slate-500">The requested post does not exist or has been deleted.</p>
            <Link href="/dashboard/posts">
              <Button variant="primary" size="sm">Back to Posts</Button>
            </Link>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-zinc-800/60">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/posts">
                <Button variant="ghost" size="sm">
                  &larr; Back to Posts
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                {post.socialAccount && (
                  <Badge platform={post.socialAccount.platform} />
                )}
                <Badge status={post.status} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPostDetails}
                isLoading={isLoading}
              >
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Delete Post
              </Button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {successMessage && (
            <Alert variant="success" onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}

          {error && (
            <Alert variant="error" title="Action Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Status Banners */}
          {post.status === PostStatus.PUBLISHING && (
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Spinner size="sm" className="text-sky-600 dark:text-sky-400" />
                <span className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                  Publishing in progress... The system is polling TikTok/Instagram for completion.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={fetchPostDetails}>
                Check Status
              </Button>
            </div>
          )}

          {post.status === PostStatus.PUBLISHED && (
            <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-base">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span>Published Successfully!</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Live on {post.socialAccount?.platform} (@{post.socialAccount?.username}) •{' '}
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : 'Just now'}
                </p>
              </div>

              {post.publishedUrl && (
                <a
                  href={post.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
                >
                  <span>View Post Live</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {post.status === PostStatus.FAILED && (
            <div className="p-5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-base">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <span>Publishing Failed</span>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  {attempts.length > 0 && attempts[0].errorMessage
                    ? attempts[0].errorMessage
                    : 'The target social platform rejected the publish request.'}
                </p>
              </div>

              <Button
                variant="danger"
                size="md"
                onClick={handleRetry}
                isLoading={isRetrying}
                className="shrink-0"
              >
                Retry Publishing Now
              </Button>
            </div>
          )}

          {/* Post Overview Card */}
          <Card glass>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Post Information</CardTitle>
                  <CardDescription>
                    Target Account: <strong>@{post.socialAccount?.username}</strong> ({post.socialAccount?.platform})
                  </CardDescription>
                </div>

                {post.status === PostStatus.DRAFT && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handlePublish}
                    isLoading={isPublishing}
                    disabled={!post.media || post.media.length === 0}
                  >
                    Publish Post Now
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Caption Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Caption
                  </label>
                  {post.status === PostStatus.DRAFT && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Edit Caption
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      rows={4}
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-3.5 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditCaption(post.caption || '');
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleUpdateCaption}
                        isLoading={isSavingCaption}
                      >
                        Save Caption
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-200 whitespace-pre-wrap">
                    {post.caption || <span className="text-slate-400 italic">No caption specified.</span>}
                  </div>
                )}
              </div>

              {/* Media Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Attached Media Files ({post.media?.length || 0})
                  </label>

                  {post.status === PostStatus.DRAFT && (
                    <div>
                      <input
                        type="file"
                        id="add-media-file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                        onChange={handleAddMedia}
                        className="hidden"
                        disabled={isUploadingMedia}
                      />
                      <label htmlFor="add-media-file">
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={isUploadingMedia}
                          className="cursor-pointer"
                        >
                          + Add Media File
                        </Button>
                      </label>
                    </div>
                  )}
                </div>

                {post.media && post.media.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {post.media.map((media, idx) => (
                      <div
                        key={media.id}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 aspect-square flex flex-col items-center justify-center"
                      >
                        {media.mediaType === 'VIDEO' ? (
                          <div className="h-full w-full flex flex-col items-center justify-center p-3 text-center bg-slate-900 text-white">
                            <svg className="h-8 w-8 text-indigo-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[10px] font-mono truncate max-w-full px-1">
                              {media.fileName}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={`${config.apiUrl}/posts/${postId}/media/${media.id}`}
                            alt={media.fileName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              // Fallback placeholder if auth stream requires special headers
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}

                        <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[10px] font-mono">
                          #{idx + 1}
                        </div>

                        {post.status === PostStatus.DRAFT && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(media.id)}
                            className="absolute top-1.5 right-1.5 bg-rose-600 text-white p-1 rounded-full opacity-80 hover:opacity-100 transition-opacity"
                            aria-label="Remove media"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 text-xs text-slate-500">
                    No media files attached. Attach at least one file to enable publishing.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Historical Attempts Card */}
          <Card glass>
            <CardHeader>
              <CardTitle>Publishing Attempts History</CardTitle>
              <CardDescription>Execution log and response status from target platforms</CardDescription>
            </CardHeader>
            <CardContent>
              {attempts.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-zinc-400 py-2">
                  No publishing attempts have been made yet for this post.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {attempts.map((attempt) => (
                    <div key={attempt.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge status={attempt.status} size="sm" />
                          <span className="text-xs font-mono text-slate-400">
                            {attempt.id.substring(0, 8)}...
                          </span>
                        </div>
                        {attempt.errorMessage && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                            {attempt.errorMessage} {attempt.apiErrorCode ? `(Code: ${attempt.apiErrorCode})` : ''}
                          </p>
                        )}
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                          Started: {new Date(attempt.startedAt).toLocaleTimeString()}{' '}
                          {attempt.finishedAt ? `• Finished: ${new Date(attempt.finishedAt).toLocaleTimeString()}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            title="Delete Post"
            description="Are you sure you want to delete this post?"
            footer={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
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
              This action will permanently delete this post, attached media, and attempt history.
            </p>
          </Modal>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
