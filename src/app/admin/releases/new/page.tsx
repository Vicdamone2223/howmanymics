'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ArtistRow = { id: string; name: string; slug: string };

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function NewReleasePage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [artists, setArtists] = useState<ArtistRow[]>([]);

  // Release form
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [artistId, setArtistId] = useState<string>('');
  const [year, setYear] = useState<number | ''>('');
  const [cover, setCover] = useState('');
  const [producers, setProducers] = useState('');
  const [labels, setLabels] = useState('');
  const [youtube, setYoutube] = useState('');

  // Tracklists
  const [tracks1, setTracks1] = useState<string[]>(['']);
  const [tracks2, setTracks2] = useState<string[]>(['']);
  const [isDouble, setIsDouble] = useState(false);

  // RIAA
  const [riaaUnits, setRiaaUnits] = useState<number | ''>('');
  const [riaaText, setRiaaText] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: meAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr) { console.error(adminErr); setOk(false); return; }
      setOk(!!meAdmin);

      const { data: artistRows } = await supabase
        .from('artists')
        .select('id,name,slug')
        .order('name', { ascending: true });
      setArtists((artistRows || []) as ArtistRow[]);
    })();
  }, []);

  useEffect(() => {
    if (!title || slug) return;
    setSlug(slugify(title));
  }, [title, slug]);

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking access…</main>;
  if (ok === false) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-bold">Add Release</h1>
        <p className="mt-2 text-sm opacity-80">You don’t have access.</p>
        <nav className="mt-3 text-sm">
          <Link href="/admin" className="opacity-80 hover:opacity-100 underline">Admin Home →</Link>
        </nav>
      </main>
    );
  }

  const toArray = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
  const toIntOrNull = (v: number | '') => (v === '' ? null : Number(v));

  function addTrack1() { setTracks1(t => [...t, '']); }
  function removeTrack1(index: number) { setTracks1(t => t.filter((_, i) => i !== index)); }
  function updateTrack1(index: number, value: string) { setTracks1(t => t.map((v, i) => (i === index ? value : v))); }

  function addTrack2() { setTracks2(t => [...t, '']); }
  function removeTrack2(index: number) { setTracks2(t => t.filter((_, i) => i !== index)); }
  function updateTrack2(index: number, value: string) { setTracks2(t => t.map((v, i) => (i === index ? value : v))); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const finalSlug = slugify(slug || title);
    const payload: any = {
      title: title.trim(),
      slug: finalSlug,
      artist_id: artistId,
      year: toIntOrNull(year),
      cover_url: cover.trim() || null,
      producers: toArray(producers),
      labels: toArray(labels),
      youtube_id: youtube.trim() || null,
      tracks: tracks1.map(t => t.trim()).filter(Boolean),
      is_double_album: isDouble,
      tracks_disc2: isDouble ? tracks2.map(t => t.trim()).filter(Boolean) : null,
      riaa_albums_sold: toIntOrNull(riaaUnits),
      riaa_certification: riaaText.trim() || null,
    };

    const { error } = await supabase.from('releases').insert(payload);
    if (error) return alert(error.message);

    alert('Release created.');
    window.location.href = '/admin/releases';
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Add New Release</h1>
        <nav className="text-sm">
          <Link href="/admin/releases" className="opacity-80 hover:opacity-100 underline mr-4">← Manage Albums</Link>
          <Link href="/admin" className="opacity-80 hover:opacity-100 underline">Admin Home</Link>
        </nav>
      </div>
      <p className="text-sm opacity-80 mb-6">Create a new album with full metadata and tracklist.</p>

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-zinc-800 p-4">
        <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
        <input className="input" placeholder="Slug (e.g., illmatic)" value={slug} onChange={e => setSlug(e.target.value)} />
        <select className="input" value={artistId} onChange={e => setArtistId(e.target.value)} required>
          <option value="">— Select artist —</option>
          {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="number" className="input" placeholder="Year (e.g., 1994)" value={year} onChange={e => setYear(e.target.value === '' ? '' : parseInt(e.target.value))} />
        <input className="input sm:col-span-2" placeholder="Cover URL" value={cover} onChange={e => setCover(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="Producers (comma separated)" value={producers} onChange={e => setProducers(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="Labels (comma separated)" value={labels} onChange={e => setLabels(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="YouTube ID (optional)" value={youtube} onChange={e => setYoutube(e.target.value)} />

        {/* RIAA */}
        <input type="text" className="input sm:col-span-2" placeholder="RIAA Certification (e.g., Gold, 2× Platinum, Diamond)" value={riaaText} onChange={e=>setRiaaText(e.target.value)} />
        <input type="number" className="input sm:col-span-2" placeholder="(Optional) RIAA Albums Sold — units" value={riaaUnits} onChange={e=>setRiaaUnits(e.target.value === '' ? '' : parseInt(e.target.value))} />

        {/* Double album toggle */}
        <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDouble} onChange={e => setIsDouble(e.target.checked)} />
          Double album (two discs)
        </label>

        {/* Disc 1 */}
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-semibold">Tracklist — Disc One</h3>
            <button type="button" onClick={() => setTracks1(t => [...t, ''])} className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">+ Add Track</button>
          </div>
          <div className="grid gap-2">
            {tracks1.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-8 text-xs opacity-70">{idx + 1}.</span>
                <input className="input flex-1" placeholder={`Track ${idx + 1} title`} value={t} onChange={e => setTracks1(arr => arr.map((v, i) => (i === idx ? e.target.value : v)))} />
                <button type="button" onClick={() => setTracks1(arr => arr.filter((_, i) => i !== idx))} className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">Remove</button>
              </div>
            ))}
          </div>
        </div>

        {/* Disc 2 */}
        {isDouble && (
          <div className="sm:col-span-2">
            <div className="mb-2 mt-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Tracklist — Disc Two</h3>
              <button type="button" onClick={() => setTracks2(t => [...t, ''])} className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">+ Add Track</button>
            </div>
            <div className="grid gap-2">
              {tracks2.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-8 text-xs opacity-70">{idx + 1}.</span>
                  <input className="input flex-1" placeholder={`Track ${idx + 1} title`} value={t} onChange={e => setTracks2(arr => arr.map((v, i) => (i === idx ? e.target.value : v)))} />
                  <button type="button" onClick={() => setTracks2(arr => arr.filter((_, i) => i !== idx))} className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn sm:col-span-2 mt-2" type="submit">Create Release</button>
      </form>

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f4f4f5;
          outline: none;
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
