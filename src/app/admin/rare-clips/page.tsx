'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Artist = { id: number; name: string; slug: string };
type Clip = {
  id: number;
  artist_id: number;
  title: string;
  url: string;
  provider: 'youtube' | 'twitter' | 'instagram' | 'link';
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
};

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function RareClipsAdmin() {
  const [ok, setOk] = useState<boolean | null>(null);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [q, setQ] = useState('');
  const [artistId, setArtistId] = useState<string>('');

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [publishedAt, setPublishedAt] = useState('');

  const [clips, setClips] = useState<Clip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: meAdmin, error } = await supabase.rpc('me_is_admin');
      if (error) { setOk(false); return; }
      setOk(!!meAdmin);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const acc: Artist[] = [];
      const PAGE = 500;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('artists')
          .select('id,name,slug')
          .order('name', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        if (!data?.length) break;
        acc.push(...(data as Artist[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setArtists(acc);
    })();
  }, []);

  const shown = useMemo(() => {
    const term = q.trim();
    if (!term) return artists.slice(0, 2000);
    const tSlug = slugify(term);
    const tLower = term.toLowerCase();
    return artists.filter(a =>
      a.name.toLowerCase().includes(tLower) ||
      a.slug.toLowerCase().includes(tSlug) ||
      slugify(a.name).includes(tSlug)
    );
  }, [artists, q]);

  async function loadClips(forArtistId: string) {
    setLoadingClips(true);
    const { data } = await supabase
      .from('rare_clips')
      .select('id,artist_id,title,url,provider,is_pinned,published_at,created_at')
      .eq('artist_id', forArtistId)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    setClips((data || []) as Clip[]);
    setLoadingClips(false);
  }

  useEffect(() => {
    if (!artistId) { setClips([]); return; }
    loadClips(artistId);
  }, [artistId]);

  async function addClip(e: React.FormEvent) {
    e.preventDefault();
    if (!artistId || !title.trim() || !url.trim()) {
      alert('Pick artist, enter title and URL.'); return;
    }
    const payload = {
      artist_id: Number(artistId),
      title: title.trim(),
      url: url.trim(),
      is_pinned: isPinned,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
    };
    const { error } = await supabase.from('rare_clips').insert(payload);
    if (error) return alert(error.message);
    setTitle(''); setUrl(''); setIsPinned(false); setPublishedAt('');
    await loadClips(artistId);
  }

  async function delClip(id: number) {
    if (!confirm('Delete this clip?')) return;
    const { error } = await supabase.from('rare_clips').delete().eq('id', id);
    if (error) return alert(error.message);
    await loadClips(artistId);
  }

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-4xl px-4 py-8">No access.</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Admin • Rare Clips</h1>
        <nav className="text-sm flex gap-3 opacity-80">
          <a className="underline" href="/admin">← Back to Admin</a>
        </nav>
      </div>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Add Clip</h2>
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <input className="input" placeholder="Search artist…" value={q} onChange={e => setQ(e.target.value)} />
          <select className="input" value={artistId} onChange={e => setArtistId(e.target.value)}>
            <option value="">— Select artist —</option>
            {shown.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <form onSubmit={addClip} className="grid gap-3">
          <input className="input" placeholder="Clip title" value={title} onChange={e => setTitle(e.target.value)} />
          <input className="input" placeholder="URL (YouTube, Twitter/X, Instagram…)" value={url} onChange={e => setUrl(e.target.value)} />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} />
              <span className="text-sm">Pin at top</span>
            </label>
            <input
              className="input"
              type="datetime-local"
              value={publishedAt}
              onChange={e => setPublishedAt(e.target.value)}
              placeholder="Published at (optional)"
            />
            <button className="btn" type="submit">Save Clip</button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Clips for Selected Artist</h2>
        {loadingClips ? (
          <div className="text-sm opacity-75">Loading…</div>
        ) : !artistId ? (
          <div className="text-sm opacity-75">Pick an artist to view clips.</div>
        ) : clips.length === 0 ? (
          <div className="text-sm opacity-75">No clips yet.</div>
        ) : (
          <ul className="space-y-3">
            {clips.map(c => (
              <li key={c.id} className="rounded border border-zinc-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs opacity-70">{c.provider}</div>
                </div>
                <div className="text-xs break-all opacity-80 mt-1">
                  <a className="underline" href={c.url} target="_blank" rel="noreferrer">{c.url}</a>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs opacity-70">
                  <div>
                    {c.is_pinned ? <span className="mr-2">📌 pinned</span> : null}
                    {c.published_at ? new Date(c.published_at).toLocaleString() : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link className="underline" href={`/artist/${artists.find(a=>a.id===c.artist_id)?.slug || ''}`} target="_blank">View artist →</Link>
                    <button className="text-red-300 underline" onClick={() => delClip(c.id)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx>{`
        .input{background:#0a0a0a;border:1px solid #27272a;border-radius:0.5rem;padding:0.5rem 0.75rem;color:#f4f4f5;outline:none}
        .input::placeholder{color:#a1a1aa}
        .input:focus{box-shadow:0 0 0 2px rgba(249,115,22,.35)}
        .btn{background:#f97316;color:#000;font-weight:700;border-radius:.5rem;padding:.55rem .9rem}
      `}</style>
    </main>
  );
}
