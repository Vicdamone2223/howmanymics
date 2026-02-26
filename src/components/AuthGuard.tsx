'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Waits for Supabase auth to hydrate from cookies before rendering children.
 * Prevents “dead page” when refreshing/returning while logged in.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Touch auth so Supabase parses cookies and restores the session
    supabase.auth.getSession().finally(() => setReady(true));

    // Optional: keep a no-op listener alive (doesn't re-render)
    const sub = supabase.auth.onAuthStateChange(() => {});
    return () => sub.data.subscription.unsubscribe();
  }, []);

  if (!ready) {
    // Lightweight placeholder so the page never renders a broken tree
    return <div className="p-6 text-sm opacity-70">Loading…</div>;
  }

  return <>{children}</>;
}
