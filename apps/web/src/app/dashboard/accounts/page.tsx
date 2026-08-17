'use client';

/* eslint-disable @next/next/no-img-element */
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ConnectionStatus, OAuthConnectResponse, Platform, SocialAccount } from '@/types';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

function AccountsContent() {
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Connection trigger states
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);

  // Disconnect modal state
  const [accountToDisconnect, setAccountToDisconnect] = useState<SocialAccount | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Banner status from OAuth redirect query
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const errorMsg = searchParams.get('error_description') || searchParams.get('error');

    if (status === 'success') {
      setNotification({
        type: 'success',
        message: `Successfully connected your ${
          platform ? platform.toUpperCase() : 'social'
        } account!`,
      });
    } else if (status === 'error') {
      setNotification({
        type: 'error',
        message: errorMsg || 'Failed to complete social account connection. Please try again.',
      });
    }
  }, [searchParams]);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<SocialAccount[]>('/social-accounts');
      setAccounts(res.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load connected social accounts';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = async (platform: Platform) => {
    setConnectingPlatform(platform);
    setError(null);
    try {
      const endpoint =
        platform === Platform.INSTAGRAM
          ? '/social-accounts/instagram/connect'
          : '/social-accounts/tiktok/connect';

      const res = await apiClient.get<OAuthConnectResponse>(endpoint);
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('No authorization URL returned from server');
      }
    } catch (err: unknown) {
      setConnectingPlatform(null);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : `Failed to initiate ${platform} connection`;
      setError(message);
    }
  };

  const handleDisconnect = async () => {
    if (!accountToDisconnect) return;
    setIsDisconnecting(true);
    setError(null);
    try {
      await apiClient.delete(`/social-accounts/${accountToDisconnect.id}`);
      setNotification({
        type: 'success',
        message: `Successfully disconnected @${accountToDisconnect.username}`,
      });
      setAccountToDisconnect(null);
      await fetchAccounts();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to disconnect account';
      setError(message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const instagramAccount = accounts.find((a) => a.platform === Platform.INSTAGRAM);
  const tikTokAccount = accounts.find((a) => a.platform === Platform.TIKTOK);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-zinc-800/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
            Social Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Connect and manage your Instagram Professional and TikTok accounts for automated publishing
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchAccounts()}
          isLoading={isLoading}
        >
          Refresh Accounts
        </Button>
      </div>

      {/* Notification Banner from OAuth */}
      {notification && (
        <Alert
          variant={notification.type}
          title={notification.type === 'success' ? 'Connection Successful' : 'Connection Notice'}
          onClose={() => setNotification(null)}
        >
          {notification.message}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="error" title="Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instagram Card */}
        <Card glass>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-xl shadow-md shadow-pink-500/20">
                  IG
                </div>
                <div>
                  <CardTitle>Instagram Professional</CardTitle>
                  <CardDescription>Meta Graph API v22.0 (Reels, Feed & Carousels)</CardDescription>
                </div>
              </div>
              <Badge variant="instagram" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {instagramAccount ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {instagramAccount.profileImageUrl ? (
                      <img
                        src={instagramAccount.profileImageUrl}
                        alt={instagramAccount.username}
                        className="h-10 w-10 rounded-full object-cover border border-slate-300 dark:border-zinc-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-amber-500 text-white font-bold text-sm">
                        {instagramAccount.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                        @{instagramAccount.username}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        ID: <code className="font-mono">{instagramAccount.platformAccountId}</code>
                      </div>
                    </div>
                  </div>
                  <Badge status={instagramAccount.connectionStatus} />
                </div>

                {instagramAccount.connectionStatus === ConnectionStatus.EXPIRED && (
                  <Alert variant="warning">
                    Your Instagram access token has expired. Re-authenticate to resume publishing.
                  </Alert>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                  <span className="text-xs text-slate-400 dark:text-zinc-500">
                    Linked on {new Date(instagramAccount.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {instagramAccount.connectionStatus === ConnectionStatus.EXPIRED && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleConnect(Platform.INSTAGRAM)}
                        isLoading={connectingPlatform === Platform.INSTAGRAM}
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => setAccountToDisconnect(instagramAccount)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-4">
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Connect your Instagram Business or Creator account to publish photos, videos, and multi-image carousel posts directly.
                </p>
                <Button
                  variant="primary"
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white shadow-md shadow-pink-500/20"
                  onClick={() => handleConnect(Platform.INSTAGRAM)}
                  isLoading={connectingPlatform === Platform.INSTAGRAM}
                >
                  Connect Instagram Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TikTok Card */}
        <Card glass>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 dark:bg-zinc-800 text-white font-bold text-xl shadow-md border border-slate-700">
                  TT
                </div>
                <div>
                  <CardTitle>TikTok Direct Post</CardTitle>
                  <CardDescription>Content Posting API v2 (Direct Video & Photo Albums)</CardDescription>
                </div>
              </div>
              <Badge variant="tiktok" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tikTokAccount ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {tikTokAccount.profileImageUrl ? (
                      <img
                        src={tikTokAccount.profileImageUrl}
                        alt={tikTokAccount.username}
                        className="h-10 w-10 rounded-full object-cover border border-slate-300 dark:border-zinc-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-sm">
                        {tikTokAccount.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                        @{tikTokAccount.username}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        ID: <code className="font-mono">{tikTokAccount.platformAccountId}</code>
                      </div>
                    </div>
                  </div>
                  <Badge status={tikTokAccount.connectionStatus} />
                </div>

                {tikTokAccount.connectionStatus === ConnectionStatus.EXPIRED && (
                  <Alert variant="warning">
                    Your TikTok access token has expired. Re-authenticate to resume publishing.
                  </Alert>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                  <span className="text-xs text-slate-400 dark:text-zinc-500">
                    Linked on {new Date(tikTokAccount.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {tikTokAccount.connectionStatus === ConnectionStatus.EXPIRED && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleConnect(Platform.TIKTOK)}
                        isLoading={connectingPlatform === Platform.TIKTOK}
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => setAccountToDisconnect(tikTokAccount)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-4">
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Connect your TikTok creator profile to publish Direct Post videos and up to 35-item photo albums automatically.
                </p>
                <Button
                  variant="primary"
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white shadow-md"
                  onClick={() => handleConnect(Platform.TIKTOK)}
                  isLoading={connectingPlatform === Platform.TIKTOK}
                >
                  Connect TikTok Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty State if neither is connected and not loading */}
      {!isLoading && accounts.length === 0 && (
        <EmptyState
          title="No Social Accounts Connected"
          description="Connect your Instagram or TikTok account above to begin composing and scheduling posts."
        />
      )}

      {/* Disconnect Confirmation Modal */}
      <Modal
        isOpen={Boolean(accountToDisconnect)}
        onClose={() => setAccountToDisconnect(null)}
        title="Disconnect Social Account"
        description={`Are you sure you want to disconnect @${accountToDisconnect?.username}?`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccountToDisconnect(null)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDisconnect}
              isLoading={isDisconnecting}
            >
              Confirm Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Disconnecting will revoke local access tokens for{' '}
          <strong className="text-slate-900 dark:text-zinc-100">
            @{accountToDisconnect?.username} ({accountToDisconnect?.platform})
          </strong>
          . Any scheduled or draft posts for this channel will fail to publish until you reconnect the account.
        </p>
      </Modal>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Suspense fallback={<div className="flex justify-center py-12"><Spinner size="lg" /></div>}>
          <AccountsContent />
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}
