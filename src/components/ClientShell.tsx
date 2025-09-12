'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import SocialEmbeds from '@/components/SocialEmbeds';
import AuthInit from '@/app/AuthInit';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  // avoid SSR/CSR drift by rendering the shell only after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <AuthInit />
      {mounted ? <Header /> : null}
      {children}
      {mounted ? <SocialEmbeds /> : null}
    </>
  );
}
