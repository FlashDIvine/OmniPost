'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { AppShell } from '@/components/layout/app-shell';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Forward all query parameters to /dashboard/accounts
    const query = searchParams.toString();
    const destination = query
      ? `/dashboard/accounts?${query}`
      : '/dashboard/accounts';
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500 dark:text-zinc-400">
        Completing social account connection and redirecting to dashboard...
      </p>
    </div>
  );
}

export default function SocialAccountsCallbackPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] justify-center items-center">
            <Spinner size="lg" />
          </div>
        }
      >
        <CallbackHandler />
      </Suspense>
    </AppShell>
  );
}
