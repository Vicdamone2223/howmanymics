'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type UserLite = { email?: string | null };

export default function HeaderClient() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserLite | null>(null);
  const [loading, setLoading] = useState(true);

  // Read the session only on the client
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const email = data.session?.user?.email ?? null;
        setUser(email ? { email } : null);
      } finally {
        setLoading(false);
        setMounted(true);
      }
    })();

    // keep it up-to-date
    const sub = supabase.auth.onAuthStateChange((_evt, sess) => {
      const email = sess?.user?.email ?? null;
      setUser(email ? { email } : null);
    });
    unsub = () => sub.data.subscription.unsubscribe();

    return () => { unsub?.(); };
  }, []);

  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-lg font-extrabold">How Many Mics</Link>

        {/* nav */}
        <nav className="ml-4 hidden md:flex items-center gap-4 text-sm">
          <Link href="/articles" className="opacity-80 hover:opacity-100">Articles</Link>
          <Link href="/reviews"  className="opacity-80 hover:opacity-100">Reviews</Link>
          <Link href="/rankings" className="opacity-80 hover:opacity-100">Rankings</Link>
          <Link href="/calendar" className="opacity-80 hover:opacity-100">Calendar</Link>
          <Link href="/debates"  className="opacity-80 hover:opacity-100">Debates</Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Render the logged-out state by default to avoid hydration drift.
              It will “flip” to logged-in right after mount. */}
          {mounted && !loading && user ? (
            <>
              <span className="text-xs opacity-70 hidden sm:inline">
                {user.email}
              </span>
              <Link href="/account" className="text-sm underline">Account</Link>
              <button
                className="text-sm px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900"
                onClick={async () => { await supabase.auth.signOut(); }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm underline">Log in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
