'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import SocialEmbeds from '@/components/SocialEmbeds';
import AuthInit from '@/app/AuthInit';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorTrap from '@/components/GlobalErrorTrap';

const DISABLE_EMBEDS = process.env.NEXT_PUBLIC_DISABLE_EMBEDS === '1';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <GlobalErrorTrap />
      <AuthInit />
      <ErrorBoundary>
        {mounted ? <Header /> : null}
        {children}
        {mounted && !DISABLE_EMBEDS ? <SocialEmbeds /> : null}
      </ErrorBoundary>
    </>
  );
}
