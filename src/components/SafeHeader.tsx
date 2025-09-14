'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; email: string | null };

export default function SafeHeader() {
  const [s, setS] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    // 1) Restore current session
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setS({ status: 'signed-out' });
        return;
      }
      const email = data.session?.user?.email ?? null;
      setS(data.session ? { status: 'signed-in', email } : { status: 'signed-out' });
    });

    // 2) React to any future changes
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!active) return;
      setS(session ? { status: 'signed-in', email: session.user?.email ?? null } : { status: 'signed-out' });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-[1400px] px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-extrabold">How Many Mics</Link>

        {s.status === 'loading' ? (
          <span className="text-xs opacity-60">…</span>
        ) : s.status === 'signed-in' ? (
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-75">{s.email ?? 'Signed in'}</span>
            <button
              className="text-sm underline"
              onClick={async () => {
                await supabase.auth.signOut();
                // optional: hard reload to clear any UI
                window.location.reload();
              }}
            >
              Log out
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-sm underline">Log in</Link>
        )}
      </div>
    </header>
  );
}
