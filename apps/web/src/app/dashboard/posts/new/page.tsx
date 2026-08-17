'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ConnectionStatus, Media, Platform, Post, SocialAccount } from '@/types';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

interface LocalMediaFile {
  file: File;
  previewUrl: string;
  id: string;
  name: string;
  size: number;
  type: string;
}

export default function NewPostPage() {
  const router = useRouter();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [mediaFiles, setMediaFiles] = useState<LocalMediaFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const res = await apiClient.get<SocialAccount[]>('/social-accounts');
        const connectedAccounts = res.data.filter(
          (a) => a.connectionStatus === ConnectionStatus.CONNECTED,
        );
        setAccounts(connectedAccounts);
        if (connectedAccounts.length > 0) {
          setSelectedAccountId(connectedAccounts[0].id);
        }
      } catch {
        setError('Failed to load social accounts');
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // File validation
  const validateAndAddFiles = (files: FileList | File[]) => {
    setError(null);
    const newMedia: LocalMediaFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check max size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 50MB maximum size limit.`);
        return;
      }

      // Check supported MIME types
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        setError(`File "${file.name}" is not a supported image or video format.`);
        return;
      }

      newMedia.push({
        file,
        previewUrl: URL.createObjectURL(file),
        id: `${file.name}-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    setMediaFiles((prev) => [...prev, ...newMedia]);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
    }
  };

  const removeMediaFile = (id: string) => {
    setMediaFiles((prev) => {
      const removed = prev.find((m) => m.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((m) => m.id !== id);
    });
  };

  // Platform rule validation checks
  const getPlatformValidationWarnings = (): string[] => {
    if (!selectedAccount) return [];
    const warnings: string[] = [];
    const videoCount = mediaFiles.filter((m) => m.type.startsWith('video/')).length;
    const imageCount = mediaFiles.filter((m) => m.type.startsWith('image/')).length;

    if (selectedAccount.platform === Platform.TIKTOK) {
      if (videoCount > 1) {
        warnings.push('TikTok only supports a single video per post.');
      }
      if (videoCount > 0 && imageCount > 0) {
        warnings.push('TikTok does not support mixing videos and photos in one post.');
      }
      if (imageCount > 35) {
        warnings.push('TikTok photo albums support a maximum of 35 photos.');
      }
      const hasPng = mediaFiles.some((m) => m.type === 'image/png');
      if (hasPng) {
        warnings.push('TikTok photo posts only support JPEG and WebP images (PNG is rejected).');
      }
    }

    if (selectedAccount.platform === Platform.INSTAGRAM) {
      if (mediaFiles.length > 10) {
        warnings.push('Instagram carousel albums support a maximum of 10 items.');
      }
    }

    return warnings;
  };

  const platformWarnings = getPlatformValidationWarnings();

  const handleSavePost = async (publishImmediately: boolean) => {
    setError(null);

    if (!selectedAccountId) {
      setError('Please select a target social media account.');
      return;
    }

    if (mediaFiles.length === 0) {
      setError('Please attach at least one media asset (image or video) to your post.');
      return;
    }

    if (platformWarnings.length > 0) {
      setError(platformWarnings[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create post draft
      setUploadProgress('Creating draft post...');
      const createRes = await apiClient.post<Post>('/posts', {
        caption: caption.trim() || undefined,
        socialAccountId: selectedAccountId,
      });

      const postId = createRes.data.id;

      // 2. Upload media files sequentially
      for (let i = 0; i < mediaFiles.length; i++) {
        setUploadProgress(`Uploading media asset ${i + 1} of ${mediaFiles.length}...`);
        const formData = new FormData();
        formData.append('file', mediaFiles[i].file);
        await apiClient.upload<Media>(`/posts/${postId}/media`, formData);
      }

      // 3. Publish immediately if requested
      if (publishImmediately) {
        setUploadProgress('Publishing post to platform...');
        await apiClient.post(`/posts/${postId}/publish`);
      }

      // 4. Redirect to post details
      router.push(`/dashboard/posts/${postId}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to create post';
      setError(message);
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-zinc-800/60">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
                Compose Post
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Draft, upload media, and publish to your connected social channels
              </p>
            </div>
            <Link href="/dashboard/posts">
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </Link>
          </div>

          {/* Account Prerequisite Check */}
          {!isLoadingAccounts && accounts.length === 0 && (
            <Alert variant="warning" title="No Connected Channels">
              You must link an Instagram or TikTok account before creating a post.{' '}
              <Link
                href="/dashboard/accounts"
                className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Go to Social Accounts &rarr;
              </Link>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="error" title="Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Platform Rule Warnings */}
          {platformWarnings.map((warn, i) => (
            <Alert key={i} variant="warning" title="Platform Constraint">
              {warn}
            </Alert>
          ))}

          {/* Composer Form Card */}
          <Card glass>
            <CardHeader>
              <CardTitle>Post Details</CardTitle>
              <CardDescription>Select destination channel, caption, and media</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 1. Target Account Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Destination Channel
                </label>
                {isLoadingAccounts ? (
                  <div className="flex items-center gap-2 py-2">
                    <Spinner size="sm" />
                    <span className="text-xs text-slate-500">Loading accounts...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          selectedAccountId === acc.id
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/30'
                            : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg font-bold text-xs text-white ${
                              acc.platform === Platform.INSTAGRAM
                                ? 'bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500'
                                : 'bg-slate-900 dark:bg-zinc-800'
                            }`}
                          >
                            {acc.platform === Platform.INSTAGRAM ? 'IG' : 'TT'}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                              @{acc.username}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400">
                              {acc.platform}
                            </div>
                          </div>
                        </div>
                        {selectedAccountId === acc.id && (
                          <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Caption Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="caption"
                    className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider"
                  >
                    Caption / Text
                  </label>
                  <span
                    className={`text-xs font-mono ${
                      caption.length > 2200
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  >
                    {caption.length} / 2200
                  </span>
                </div>
                <textarea
                  id="caption"
                  name="caption"
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write an engaging caption with #hashtags..."
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-3.5 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
              </div>

              {/* 3. Media Uploader Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Media Assets (Photos / Videos)
                </label>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600'
                  }`}
                >
                  <input
                    type="file"
                    id="media-upload"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg
                      className="h-10 w-10 text-slate-400 dark:text-zinc-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <div className="text-sm">
                      <label
                        htmlFor="media-upload"
                        className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer"
                      >
                        Click to upload
                      </label>{' '}
                      <span className="text-slate-500 dark:text-zinc-400">or drag and drop</span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      JPEG, PNG, WebP, MP4, QuickTime (up to 50MB each)
                    </p>
                  </div>
                </div>

                {/* Media Preview Grid */}
                {mediaFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                    {mediaFiles.map((media, index) => (
                      <div
                        key={media.id}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 aspect-square"
                      >
                        {media.type.startsWith('video/') ? (
                          <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center bg-slate-900 text-white">
                            <svg className="h-8 w-8 text-indigo-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[10px] font-mono truncate max-w-full px-1">
                              {media.name}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={media.previewUrl}
                            alt={media.name}
                            className="h-full w-full object-cover"
                          />
                        )}

                        <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[10px] font-mono">
                          #{index + 1}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeMediaFile(media.id)}
                          disabled={isSubmitting}
                          className="absolute top-1.5 right-1.5 bg-rose-600 text-white p-1 rounded-full opacity-80 hover:opacity-100 transition-opacity"
                          aria-label="Remove media"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress message */}
              {uploadProgress && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs">
                  <Spinner size="sm" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => handleSavePost(false)}
                  isLoading={isSubmitting && uploadProgress?.includes('draft')}
                  disabled={isSubmitting || accounts.length === 0}
                  className="w-full sm:w-auto"
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => handleSavePost(true)}
                  isLoading={isSubmitting && !uploadProgress?.includes('draft')}
                  disabled={isSubmitting || accounts.length === 0}
                  className="w-full sm:w-auto"
                >
                  Save & Publish Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
