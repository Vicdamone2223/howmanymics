'use client';

import { useEffect, useState } from 'react';

export default function HardClientShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // render nothing until on the client (eliminates hydration drift)
  return <>{children}</>;
}
