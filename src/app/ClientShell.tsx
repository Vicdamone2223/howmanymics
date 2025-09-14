// src/app/ClientShell.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Header = dynamic(() => import('@/components/Header'), { ssr: false });
const SocialEmbeds = dynamic(() => import('@/components/SocialEmbeds'), { ssr: false });
const AuthInit = dynamic(() => import('@/app/AuthInit'), { ssr: false });

const SAFE_MODE = process.env.NEXT_PUBLIC_SAFE_MODE === '1';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [clientErr, setClientErr] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // Global error traps – if anything crashes before React logs, we still see it.
    const onErr = (e: ErrorEvent) => setClientErr(e?.error?.message || e.message || 'client error');
    const onRej = (e: PromiseRejectionEvent) =>
      setClientErr(String((e?.reason && (e.reason.message || e.reason)) || 'unhandledrejection'));

    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);

    // Also log visibility changes just to confirm the tab-switch path
    const onVis = () => console.debug('[vis]', document.visibilityState, Date.now());
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // identical HTML on server and pre-mount
  if (!mounted) return <div style={{ minHeight: '100vh' }} />;

  if (SAFE_MODE) {
    // Render the bare minimum: no auth init, no header, no embeds, no children.
    return (
      <div className="p-4">
        <div className="rounded border border-zinc-700 p-3 text-sm">
          <strong>Safe Mode</strong> is ON (NEXT_PUBLIC_SAFE_MODE=1). Only a static shell is rendered.
        </div>
        {clientErr ? (
          <pre className="mt-3 whitespace-pre-wrap rounded border border-red-700 bg-red-950/30 p-3 text-red-300">
            Client error: {clientErr}
          </pre>
        ) : null}
      </div>
    );
  }

  // Normal path
  return (
    <>
      <AuthInit />
      <Header />
      {children}
      <SocialEmbeds />
      {clientErr ? (
        <pre className="fixed bottom-2 right-2 max-w-[50vw] whitespace-pre-wrap rounded border border-red-700 bg-red-950/60 p-2 text-xs text-red-200">
          Client error: {clientErr}
        </pre>
      ) : null}
    </>
  );
}
