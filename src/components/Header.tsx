// src/components/Header.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

export default function Header() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // mobile / menu state
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let authSub: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null;

    async function hydrateFromSession() {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user || null;
      setEmail(u?.email ?? null);

      if (u?.id) {
        const { data: p } = await supabase
          .from('profiles')
          .select('display_name,username,avatar_url')
          .eq('id', u.id)
          .single();
        if (p) setProfile(p as Profile);
      } else {
        setProfile(null);
      }

      // Check admin flag via RPC
      try {
        const { data: isAdm, error } = await supabase.rpc('me_is_admin');
        setIsAdmin(Boolean(isAdm) && !error);
      } catch {
        setIsAdmin(false);
      }
    }

    hydrateFromSession();

    authSub = supabase.auth.onAuthStateChange(async (_evt, sess) => {
      const user = sess?.user || null;
      setEmail(user?.email ?? null);
      setProfile(null);

      if (user?.id) {
        supabase
          .from('profiles')
          .select('display_name,username,avatar_url')
          .eq('id', user.id)
          .single()
          .then(({ data: p }) => p && setProfile(p as Profile));
      }

      try {
        const { data: isAdm, error } = await supabase.rpc('me_is_admin');
        setIsAdmin(Boolean(isAdm) && !error);
      } catch {
        setIsAdmin(false);
      }
    });

    // close avatar menu when clicking outside
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);

    return () => {
      authSub?.data.subscription.unsubscribe();
      document.removeEventListener('mousedown', onDoc);
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    setNavOpen(false);
    setIsAdmin(false);
    router.refresh();
  }

  const initials = email ? (email[0] || '').toUpperCase() : '';
  const avatarSrc = profile?.avatar_url || null;

  const NAV = [
    { href: '/artists', label: 'Artists' },
    { href: '/releases', label: 'Albums' },
    { href: '/rankings', label: 'Rankings' },
    { href: '/articles', label: 'Articles' },
    { href: '/reviews', label: 'Reviews' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/debates', label: 'Debates' },
    { href: '/today', label: 'Today in Hip-Hop' },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 text-zinc-900 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/placeholder/hmmlogo.png" alt="How Many Mics" className="h-10 w-auto" />
          <span className="sr-only">How Many Mics</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm ml-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="opacity-80 hover:opacity-100">
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Search (desktop) */}
        <form action="/search" className="hidden md:block flex-1">
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search artists, albums…"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
          />
        </form>

        {/* Right side (desktop) */}
        <div className="hidden md:flex items-center gap-2 relative" ref={menuRef}>
          {!email ? (
            <Link href="/login" className="text-sm opacity-80 hover:opacity-100">
              Sign in
            </Link>
          ) : (
            <>
              {/* Avatar button opens a small menu */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="h-9 w-9 rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 grid place-items-center overflow-hidden"
              >
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-bold">{initials}</span>
                )}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-11 w-44 rounded-lg border border-zinc-200 bg-white shadow-md p-1 text-sm"
                >
                  <Link
                    role="menuitem"
                    href="/account"
                    className="block rounded px-3 py-2 hover:bg-zinc-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    My profile
                  </Link>
                  <Link
                    role="menuitem"
                    href="/account/settings"
                    className="block rounded px-3 py-2 hover:bg-zinc-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </Link>

                  {/* Admin only */}
                  {isAdmin && (
                    <Link
                      role="menuitem"
                      href="/admin"
                      className="block rounded px-3 py-2 hover:bg-zinc-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    role="menuitem"
                    onClick={signOut}
                    className="w-full text-left rounded px-3 py-2 hover:bg-zinc-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Mobile: menu button */}
        <button
          type="button"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
          className="md:hidden ml-auto h-11 w-11 rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 shadow-sm grid place-items-center"
        >
          {!navOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" className="opacity-90">
              <rect x="3" y="6" width="14" height="2" rx="1"></rect>
              <circle cx="19" cy="7" r="2"></circle>
              <rect x="7" y="11" width="14" height="2" rx="1"></rect>
              <circle cx="5" cy="12" r="2"></circle>
              <rect x="3" y="16" width="14" height="2" rx="1"></rect>
              <circle cx="19" cy="17" r="2"></circle>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" className="opacity-90">
              <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile panel */}
      {navOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 space-y-3">
            {/* Search (mobile) */}
            <form action="/search">
              <input
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search artists, albums…"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </form>

            {/* Nav links */}
            <nav className="grid gap-2">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setNavOpen(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                >
                  {n.label}
                </Link>
              ))}

              {!email ? (
                <Link
                  href="/login"
                  onClick={() => setNavOpen(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                >
                  Sign in
                </Link>
              ) : (
                <>
                  <Link
                    href="/account"
                    onClick={() => setNavOpen(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                  >
                    My profile
                  </Link>
                  <Link
                    href="/account/settings"
                    onClick={() => setNavOpen(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                  >
                    Settings
                  </Link>

                  {/* Admin only */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setNavOpen(false)}
                      className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    onClick={signOut}
                    className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 text-left"
                  >
                    Sign out
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
