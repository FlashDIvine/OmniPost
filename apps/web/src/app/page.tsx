'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { config } from '@/lib/config';
import { Platform } from '@/types';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface HealthStatus {
  status: string;
  timestamp?: string;
  uptime?: number;
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkApiHealth = async () => {
    setApiStatus('checking');
    setError(null);
    const start = performance.now();
    try {
      const response = await apiClient.get<HealthStatus>('/health');
      const end = performance.now();
      setLatency(Math.round(end - start));
      setHealth(response.data);
      setApiStatus(response.data.status === 'ok' ? 'online' : 'offline');
    } catch (err: unknown) {
      setApiStatus('offline');
      setHealth(null);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Unable to reach OmniPost API backend';
      setError(message);
    }
  };

  useEffect(() => {
    checkApiHealth();
  }, []);

  return (
    <AppShell apiStatus={apiStatus}>
      <div className="space-y-8">
        {/* Header Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-zinc-800/60">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-4xl">
              OmniPost Foundation
            </h1>
            <p className="mt-1.5 text-base text-slate-500 dark:text-zinc-400">
              Next.js 15 App Router frontend connected to NestJS modular backend engine.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge platform={Platform.INSTAGRAM} />
            <Badge platform={Platform.TIKTOK} />
            <Badge variant="success">Phase 9.1 Ready</Badge>
          </div>
        </div>

        {/* API Health & Connection Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2" glass>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Backend Integration Status</CardTitle>
                  <CardDescription>
                    Endpoint target: <code className="text-xs bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono">{config.apiUrl}</code>
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkApiHealth}
                  isLoading={apiStatus === 'checking'}
                >
                  Ping API
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="warning" title="Connection Notice" className="mb-4">
                  {error} (Ensure NestJS backend is running on port 3001)
                </Alert>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-zinc-700/50">
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Service Status</div>
                  <div className="mt-1.5 text-lg font-bold flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        apiStatus === 'online'
                          ? 'bg-emerald-500'
                          : apiStatus === 'offline'
                            ? 'bg-rose-500'
                            : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    <span className="capitalize">{apiStatus}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-zinc-700/50">
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Round-Trip Latency</div>
                  <div className="mt-1.5 text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                    {latency !== null ? `${latency} ms` : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-zinc-700/50 col-span-2 sm:col-span-1">
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Engine Uptime</div>
                  <div className="mt-1.5 text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                    {health?.uptime !== undefined ? `${Math.floor(health.uptime)}s` : '—'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Architecture Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Phase 9.1 Foundation</CardTitle>
              <CardDescription>Prepared core abstractions</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Unified API Client (<code className="text-xs font-mono">ApiClient</code>)</span>
                </li>
                <li className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>JWT Auth Context (<code className="text-xs font-mono">useAuth</code>)</span>
                </li>
                <li className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Domain Types & Status Enums</span>
                </li>
                <li className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Application Shell & UI Primitives</span>
                </li>
                <li className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Cookie Credentials Support</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Publishing Capabilities Ready Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Backend Pipeline Capabilities</CardTitle>
            <CardDescription>
              Backend publishing modules ready for UI integration in subsequent phases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Instagram Publishing Adapter</span>
                  <Badge variant="instagram">Phase 7 PASS</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Meta Graph API v22.0. Supports Single Image, Single Video/Reels, and 2–10 item Carousel Albums.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">TikTok Publishing Adapter</span>
                  <Badge variant="tiktok">Phase 8 PASS</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  TikTok Content Posting API v2. Supports Single Video Direct Post and 1–35 item Photo Albums (JPEG/WEBP).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
