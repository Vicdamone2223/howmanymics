// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState(''); // signup confirm
  const [showPass, setShowPass] = useState(false);

  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus('working'); setMsg('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Logged in successfully
      if (data.session) {
        setStatus('done');
        router.replace('/'); // or /account
        return;
      }
      setStatus('error'); setMsg('Sign in failed. Please try again.');
    } catch (err: any) {
      setStatus('error'); setMsg(err?.message || 'Could not sign in.');
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setStatus('working'); setMsg('');
    try {
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (password !== password2) throw new Error('Passwords do not match.');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Optional: add redirect for email-confirm flow
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;

      // Two possibilities based on your Supabase settings:
      // - If "Email confirmations" are ON (recommended), no session yet:
      //   show a message asking the user to verify email.
      // - If confirmations are OFF (auto-confirm), session will exist:
      if (data.session) {
        setStatus('done');
        router.replace('/');
        return;
      }
      setStatus('done');
      setMsg('Check your email to confirm your account, then come back and sign in.');
    } catch (err: any) {
      setStatus('error'); setMsg(err?.message || 'Could not create account.');
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight mb-4">
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </h1>

      {/* Mode toggle */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setMode('signin'); setMsg(''); }}
          className={`px-3 py-2 rounded-lg border ${mode === 'signin' ? 'border-orange-500 bg-orange-500/15' : 'border-zinc-700'}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setMsg(''); }}
          className={`px-3 py-2 rounded-lg border ${mode === 'signup' ? 'border-orange-500 bg-orange-500/15' : 'border-zinc-700'}`}
        >
          Create account
        </button>
      </div>

      {/* Forms */}
      {mode === 'signin' ? (
        <form onSubmit={handleSignIn} className="grid gap-3">
          <input
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div className="relative">
            <input
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 pr-20 outline-none focus:ring-2 focus:ring-orange-500"
              type={showPass ? 'text' : 'password'}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>

          <button
            className="rounded-lg bg-orange-500 font-bold text-black px-3 py-2 disabled:opacity-60"
            type="submit"
            disabled={status === 'working'}
          >
            {status === 'working' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="grid gap-3">
          <input
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
          <input
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
            type="password"
            placeholder="Confirm password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />

          <button
            className="rounded-lg bg-orange-500 font-bold text-black px-3 py-2 disabled:opacity-60"
            type="submit"
            disabled={status === 'working'}
          >
            {status === 'working' ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}

      {msg && (
        <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-400' : 'opacity-90'}`}>
          {msg}
        </p>
      )}

      {/* Optional: small note */}
      <div className="mt-6 text-xs opacity-70 space-y-1">
        <p>
          Trouble signing in? Make sure email + password are correct, or try creating an account.
        </p>
      </div>
    </main>
  );
}
