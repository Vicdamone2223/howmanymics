'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ProfileRow = {
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) {
        setLoading(false);
        return;
      }
      setUserId(u.id);
      setEmail(u.email ?? null);

      const { data: p } = await supabase
        .from('profiles')
        .select('display_name,username,bio,avatar_url')
        .eq('id', u.id)
        .single();

      if (p) {
        setDisplayName(p.display_name ?? '');
        setUsername(p.username ?? '');
        setBio(p.bio ?? '');
        setAvatarUrl(p.avatar_url ?? null);
      }

      setLoading(false);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const payload: Partial<ProfileRow> & { id: string } = {
      id: userId,
      display_name: displayName.trim() || null,
      username: username.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      alert(error.message);
      return;
    }
    alert('Profile saved!');
  }

  async function handleAvatarUpload(file: File) {
    if (!userId) return;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      if (pub?.publicUrl) setAvatarUrl(pub.publicUrl);
    } catch (e: any) {
      alert(e.message || 'Upload failed. Make sure the "avatars" bucket exists and is public.');
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">Loading…</main>
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-2">My profile</h1>
        <p className="opacity-80">
          You’re not signed in.{' '}
          <Link href="/login" className="underline">Sign in</Link>
          {' '}to edit your profile.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-1">My profile</h1>
      <p className="text-sm opacity-70 mb-6">{email}</p>

      <form onSubmit={handleSave} className="grid gap-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl || '/placeholder/cover2.jpg'}
            alt="Avatar"
            className="h-16 w-16 rounded-full object-cover border border-zinc-300"
          />
          <label className="text-sm">
            <span className="inline-block rounded border border-zinc-300 px-3 py-1 cursor-pointer hover:bg-zinc-50">
              Upload avatar
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarUpload(f);
              }}
            />
          </label>
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-70">Display name</label>
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should we call you?"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-70">Username</label>
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. @hiphopfan"
          />
          <p className="text-xs opacity-60">Usernames should be unique.</p>
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-70">Bio</label>
          <textarea
            className="rounded-lg border border-zinc-300 px-3 py-2 min-h-[100px]"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people a bit about you…"
          />
        </div>

        <button className="self-start rounded-lg bg-zinc-900 text-white font-semibold px-4 py-2">
          Save changes
        </button>
      </form>
    </main>
  );
}
