// src/app/test-avatar/page.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function TestAvatarUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>('');
  const [url, setUrl] = useState<string>('');

  async function doUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setUrl('');

    if (!file) {
      setMsg('Pick a file first.');
      return;
    }

    // must be signed in (writes are authenticated-only)
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) {
      setMsg('You need to be signed in to upload.');
      return;
    }

    try {
      // unique path: userId/epoch-filename
      const cleanName = file.name.replace(/\s+/g, '-').toLowerCase();
      const path = `${user.id}/${Date.now()}-${cleanName}`;

      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (upErr) throw upErr;

      // get a public URL to verify read access
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('No public URL returned');

      setUrl(pub.publicUrl);
      setMsg('Upload succeeded!');

      // OPTIONAL: save to your profile (uncomment if you want)
      // await supabase.from('profiles').upsert({
      //   id: user.id,
      //   avatar_url: pub.publicUrl,
      //   updated_at: new Date().toISOString(),
      // });

    } catch (err: any) {
      setMsg(err?.message || String(err));
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Avatar upload test</h1>

      <form onSubmit={doUpload} className="space-y-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full"
        />
        <button className="px-3 py-2 rounded bg-orange-500 font-semibold text-black" type="submit">
          Upload
        </button>
      </form>

      {msg && <p className="mt-4 text-sm opacity-80">{msg}</p>}

      {url && (
        <div className="mt-6">
          <div className="text-sm mb-2 break-all">{url}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Uploaded avatar preview"
            className="h-32 w-32 rounded-full object-cover border border-zinc-800"
          />
        </div>
      )}
    </main>
  );
}
