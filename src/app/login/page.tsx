// src/app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'exchanging'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');

  // 1) Handle modern PKCE flow: /login?code=XXXX
  useEffect(() => {
    const code = params.get('code');
    if (!code) return;
    (async () => {
      try {
        setStatus('exchanging');
        setMsg('Signing you in…');
        // Changed: pass string code instead of object
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
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

  // 2) Legacy hash flow fallback: /login#access_token=...
  useEffect(() => {
    // Supabase JS automatically parses the hash if present,
    // but we can check for an existing session and redirect.
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        router.replace('/');
      }
    })();
  }, [router]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    try {
      setStatus('sending');
      setMsg('');
      // Ensure this matches your Supabase Auth redirect settings
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      setStatus('sent');
      setMsg('Magic link sent. Open it on this same device/browser.');
    } catch (e: any) {
      setStatus('error');
      setMsg(e?.message || 'Failed to send link.');
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight mb-4">Sign in</h1>
      <form onSubmit={sendLink} className="grid gap-3">
        <input
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          required
        />
        <button
          className="rounded-lg bg-orange-500 font-bold text-black px-3 py-2 disabled:opacity-60"
          type="submit"
          disabled={status==='sending' || status==='exchanging'}
        >
          {status==='sending' ? 'Sending…' : status==='exchanging' ? 'Signing you in…' : 'Send magic link'}
        </button>
      </form>

      {msg && (
        <p className={`mt-3 text-sm ${status==='error' ? 'text-red-400' : 'opacity-90'}`}>
          {msg}
        </p>
      )}

      <div className="mt-6 text-xs opacity-70 space-y-1">
        <p>Tip: Open the email on this same device at <b>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}</b>.</p>
        <p>If it doesn’t sign you in, copy the link, paste it into the address bar, and hit enter.</p>
      </div>
    </main>
  );
}
