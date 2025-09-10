'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  instagram: string | null;
};

function slugUsername(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

export default function SettingsPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState<Profile | null>(null);

  // local inputs
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [instagram, setInstagram] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const canSave = useMemo(() => !saving && !!uid, [saving, uid]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;
      setUid(userId);

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,bio,location,website,twitter,instagram')
        .eq('id', userId)
        .single();

      if (prof) {
        setP(prof as Profile);
        setDisplayName(prof.display_name ?? '');
        setUsername(prof.username ?? '');
        setBio(prof.bio ?? '');
        setLocation(prof.location ?? '');
        setWebsite(prof.website ?? '');
        setTwitter(prof.twitter ?? '');
        setInstagram(prof.instagram ?? '');
        setAvatarUrl(prof.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, []);

  async function uploadAvatar(file: File) {
    if (!uid) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      alert(error.message);
      return;
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    if (pub?.publicUrl) setAvatarUrl(pub.publicUrl);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    try {
      const cleanUser = username ? slugUsername(username) : null;

      const payload = {
        id: uid,
        display_name: displayName.trim() || null,
        username: cleanUser,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        twitter: twitter.trim().replace(/^@/, '') || null,
        instagram: instagram.trim().replace(/^@/, '') || null,
        avatar_url: avatarUrl,
      };

      // upsert so we survive if the row somehow didn't get created by the trigger
      const { error } = await supabase.from('profiles').upsert(payload).eq('id', uid);
      if (error) throw error;

      alert('Saved!');
      router.refresh();
    } catch (err: any) {
      // likely a duplicate username (unique index)
      alert(err?.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-8">Loading…</main>;
  if (!uid) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-3 opacity-80">
          Please <a className="underline" href="/login">sign in</a> to edit your profile.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Profile settings</h1>

      <form onSubmit={save} className="grid gap-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl || '/placeholder/cover1.jpg'}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover border border-zinc-800"
          />
          <label className="cursor-pointer text-sm px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-900">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
            Upload new…
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Username (a-z, 0-9, _)"
            value={username}
            onChange={(e) => setUsername(slugUsername(e.target.value))}
          />
        </div>

        <textarea
          className="input"
          placeholder="Short bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <input className="input" placeholder="Website (https://…)" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Twitter (handle only)" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
          <input className="input" placeholder="Instagram (handle only)" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </div>

        <div>
          <button className="btn" type="submit" disabled={!canSave}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          color: #f4f4f5;
          outline: none;
          width: 100%;
        }
        .input::placeholder { color: #a1a1aa; }
        .input:focus { box-shadow: 0 0 0 2px rgba(249,115,22,0.35); }
        .btn {
          background: #f97316; color: #000; font-weight: 700;
          border-radius: 0.5rem; padding: 0.6rem 0.9rem;
        }
      `}</style>
    </main>
  );
}
