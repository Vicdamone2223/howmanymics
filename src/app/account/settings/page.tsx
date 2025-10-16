'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function AccountSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user || null;
      setEmail(u?.email ?? null);
      setNewEmail(u?.email ?? '');
      setLoading(false);
    })();
  }, []);

  async function updateEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail) return;

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      alert(error.message);
      return;
    }
    alert('Check your new inbox to confirm the change.');
  }

  async function signOutEverywhere() {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      alert(error.message);
      return;
    }
    window.location.href = '/';
  }

  if (loading) {
    return <main className="mx-auto max-w-3xl px-4 py-8">Loading…</main>;
  }

  if (!email) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-2">Settings</h1>
        <p className="opacity-80">
          You’re not signed in. <Link href="/login" className="underline">Sign in</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Email</h2>
        <form onSubmit={updateEmail} className="flex flex-col sm:flex-row gap-2">
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 flex-1"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            placeholder="your@email.com"
          />
          <button className="rounded-lg bg-zinc-900 text-white font-semibold px-4 py-2">
            Update
          </button>
        </form>
        <p className="text-xs opacity-60 mt-1">
          We’ll send a confirmation link to finish changing your email.
        </p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Security</h2>
        <button
          onClick={signOutEverywhere}
          className="rounded-lg border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
        >
          Sign out on all devices
        </button>
      </section>
    </main>
  );
}
