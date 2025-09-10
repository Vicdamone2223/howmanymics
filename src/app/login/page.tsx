// src/app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [status, setStatus] =
    useState<'idle' | 'sending' | 'sent' | 'exchanging' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('');

  // Handle PKCE callback: /login?code=...
  useEffect(() => {
    const code = params.get('code');
    if (!code) return;

    (async () => {
      try {
        setStatus('exchanging');
        setMsg('Signing you in…');

        // PKCE exchange (string param)
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // Ensure a basic profile exists (ignore failures due to RLS if any)
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const user = userRes?.user;
          if (user?.id) {
            const { data: existing } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', user.id)
              .maybeSingle();

            if (!existing) {
              await supabase.from('profiles').insert({
                id: user.id,
                username: null,
                display_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null,
                avatar_url: user.user_metadata?.avatar_url ?? null,
              });
            }
          }
        } catch {
          // best-effort only
        }

        if (data.session) {
          router.replace('/');
          return;
        }
        setStatus('error');
        setMsg('Could not create a session from the code. Try sending the link again.');
      } catch (e: any) {
        setStatus('error');
        setMsg(e?.message || 'Sign-in failed. Try again.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // If already logged in, bounce home
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace('/');
    })();
  }, [router]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    try {
      setStatus('sending');
      setMsg('');

      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          // IMPORTANT: allow new visitors to create an account via the same link
          shouldCreateUser: true,
        },
      });

      if (error) throw error;
      setStatus('sent');
      setMsg('Magic link sent. Check your email and open it on this device.');
    } catch (e: any) {
      setStatus('error');
      setMsg(e?.message || 'Failed to send link.');
    }
  }

  async function signInWithGoogle() {
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: any) {
      setStatus('error');
      setMsg(e?.message || 'Google sign-in failed.');
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight mb-2">Welcome</h1>
      <p className="text-sm opacity-80 mb-6">
        Sign in <em>or create an account</em> with a magic link.
      </p>

      <form onSubmit={sendLink} className="grid gap-3">
        <input
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          className="rounded-lg bg-orange-500 font-bold text-black px-3 py-2 disabled:opacity-60"
          type="submit"
          disabled={status === 'sending' || status === 'exchanging'}
        >
          {status === 'sending'
            ? 'Sending…'
            : status === 'exchanging'
            ? 'Signing you in…'
            : 'Send magic link'}
        </button>
      </form>

      {/* Optional Google OAuth */}
      <div className="mt-4">
        <button
          onClick={signInWithGoogle}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
        >
          Continue with Google
        </button>
      </div>

      {msg && (
        <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-400' : 'opacity-90'}`}>
          {msg}
        </p>
      )}

      <div className="mt-6 text-xs opacity-70 space-y-1">
        <p>
          Tip: Open the email on this same device at{' '}
          <b>
            {typeof window !== 'undefined'
              ? window.location.origin
              : 'http://localhost:3000'}
          </b>
          .
        </p>
        <p>If it doesn’t sign you in, copy the link, paste it into the address bar, and hit enter.</p>
      </div>
    </main>
  );
}
