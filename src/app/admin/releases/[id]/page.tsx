'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ReleasePicker from '@/components/ReleasePicker';

type ArtistRow = { id: number | string; name: string; slug: string };

// Local lightweight type for “similar” rows
type ReleaseLite = { id: number | string; title: string; slug: string };

type ReleaseRow = {
  id: number | string;
  title: string;
  slug: string;
  artist_id: number | string;
  year: number | null;
  cover_url: string | null;
  producers: string[] | null;
  labels: string[] | null;
  youtube_id: string | null;
  riaa_cert: string | null;
  is_double_album: boolean | null;
  tracks_disc1: string[] | null;
  tracks_disc2: string[] | null;
  rating_staff: number | null;
};

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Loosen typing ONLY for the multi-select usage below; runtime stays identical
const ReleasePickerAny = ReleasePicker as unknown as (props: any) => JSX.Element;

export default function EditReleasePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // reference data
  const [artists, setArtists] = useState<ArtistRow[]>([]);

  // base release fields
  const [relId, setRelId] = useState<number | string | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [cover, setCover] = useState('');
  const [producers, setProducers] = useState('');
  const [labels, setLabels] = useState('');
  const [youtube, setYouTube] = useState('');
  const [riaa, setRIAA] = useState('');
  const [isDouble, setIsDouble] = useState(false);
  const [tracks1, setTracks1] = useState<string[]>(['']);
  const [tracks2, setTracks2] = useState<string[]>(['']);
  const [ratingStaff, setRatingStaff] = useState<string>(''); // free-type 50–100

  // multi-artist
  const [albumArtists, setAlbumArtists] = useState<ArtistRow[]>([]);
  const [primaryId, setPrimaryId] = useState<number | string | null>(null);
  const [artistQuery, setArtistQuery] = useState('');

  // similars
  const [similar, setSimilar] = useState<ReleaseLite[]>([]);

  // review editor
  const [revTitle, setRevTitle] = useState('');
  const [revSlug, setRevSlug] = useState('');
  const [revExcerpt, setRevExcerpt] = useState('');
  const [revCover, setRevCover] = useState('');
  const [revBody, setRevBody] = useState('');
  const [revFeatured, setRevFeatured] = useState(false);
  const [revPublishNow, setRevPublishNow] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      setNote(null);

      // admin gate
      const { data: meAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr || !meAdmin) {
        setOk(false);
        setLoading(false);
        return;
      }
      setOk(true);

      // fetch ALL artists
      const fetchedArtists: ArtistRow[] = [];
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
        fetchedArtists.push(...(data as ArtistRow[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setArtists(fetchedArtists);

      // load release by id or slug
      const nId = Number(id);
      let rel: ReleaseRow | null = null;

      if (!Number.isNaN(nId)) {
        const { data, error } = await supabase.from('releases').select('*').eq('id', nId).single();
        if (!error && data) rel = data as ReleaseRow;
      }
      if (!rel) {
        const { data, error } = await supabase.from('releases').select('*').eq('slug', id).single();
        if (!error && data) rel = data as ReleaseRow;
      }
      if (!rel) {
        setErr('Release not found.');
        setLoading(false);
        return;
      }

      // hydrate
      setRelId(rel.id);
      setTitle(rel.title || '');
      setSlug(rel.slug || '');
      setYear(rel.year ?? '');
      setCover(rel.cover_url || '');
      setProducers((rel.producers || []).join(', '));
      setLabels((rel.labels || []).join(', '));
      setYouTube(rel.youtube_id || '');
      setRIAA(rel.riaa_cert || '');
      setIsDouble(!!rel.is_double_album);
      setTracks1((rel.tracks_disc1 && rel.tracks_disc1.length ? rel.tracks_disc1 : ['']).slice());
      setTracks2((rel.tracks_disc2 && rel.tracks_disc2.length ? rel.tracks_disc2 : ['']).slice());
      setRatingStaff(rel.rating_staff != null ? String(rel.rating_staff) : '');

      // release artists
      const { data: ra } = await supabase
        .from('release_artists')
        .select('artist_id,position,is_primary')
        .eq('release_id', rel.id)
        .order('position', { ascending: true });

      let selected: ArtistRow[] = [];
      let primary: number | string | null = rel.artist_id;

      if (ra?.length) {
        const amap = new Map(fetchedArtists.map((a) => [String(a.id), a]));
        selected = ra.map((row) => amap.get(String(row.artist_id))).filter(Boolean) as ArtistRow[];
        const prim = ra.find((r) => r.is_primary);
        if (prim) primary = prim.artist_id;
      } else {
        const a = fetchedArtists.find((a) => String(a.id) === String(rel.artist_id));
        if (a) selected = [a];
      }
      setAlbumArtists(selected);
      setPrimaryId(primary);

      // similars
      const { data: simRows } = await supabase
        .from('release_similars')
        .select('position, s:similar_release_id (id,title,slug)')
        .eq('release_id', rel.id)
        .order('position', { ascending: true });

      const sims = ((simRows || []).map((x: { s: ReleaseLite | null }) => x.s).filter(Boolean) as ReleaseLite[]);
      setSimilar(sims);

      setLoading(false);
    })();
  }, [id]);

  // helpers
  const toArray = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const addTrack1 = () => setTracks1((prev) => [...prev, '']);
  const addTrack2 = () => setTracks2((prev) => [...prev, '']);
  const setTrack1At = (i: number, v: string) => setTracks1((p) => p.map((t, idx) => (idx === i ? v : t)));
  const setTrack2At = (i: number, v: string) => setTracks2((p) => p.map((t, idx) => (idx === i ? v : t)));
  const removeTrack1 = (i: number) => setTracks1((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : ['']));
  const removeTrack2 = (i: number) => setTracks2((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : ['']));

  const canSave = useMemo(() => !!relId && !!title, [relId, title]);

  const matches = useMemo(() => {
    const q = artistQuery.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(albumArtists.map((a) => String(a.id)));
    return artists
      .filter(
        (a) =>
          !taken.has(String(a.id)) &&
          (a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [artistQuery, albumArtists, artists]);

  function addArtist(a: ArtistRow) {
    if (albumArtists.length >= 3) return;
    setAlbumArtists((prev) => [...prev, a]);
    if (primaryId == null) setPrimaryId(a.id);
    setArtistQuery('');
  }
  function removeArtist(idA: number | string) {
    setAlbumArtists((prev) => prev.filter((a) => String(a.id) !== String(idA)));
    if (String(primaryId) === String(idA)) {
      const next = albumArtists.find((a) => String(a.id) !== String(idA));
      setPrimaryId(next ? next.id : null);
    }
  }
  function moveArtist(idx: number, dir: -1 | 1) {
    setAlbumArtists((prev) => {
      const arr = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  }

  async function saveRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !relId) return;

    setErr(null);
    setNote(null);
    setSaving(true);

    try {
      const staffNum =
        ratingStaff.trim() === '' ? null : Math.max(50, Math.min(100, parseInt(ratingStaff, 10) || 0));

      // base update
      const payload: Partial<ReleaseRow> = {
        title: title.trim(),
        slug: slugify(slug || title),
        year: year === '' ? null : Number(year),
        cover_url: cover.trim() || null,
        producers: toArray(producers),
        labels: toArray(labels),
        youtube_id: youtube.trim() || null,
        riaa_cert: riaa.trim() || null,
        is_double_album: isDouble,
        tracks_disc1: tracks1.map((t) => t.trim()).filter(Boolean),
        tracks_disc2: isDouble ? tracks2.map((t) => t.trim()).filter(Boolean) : null,
        artist_id: primaryId != null ? Number(primaryId) : undefined, // keep legacy column in sync
        rating_staff: staffNum,
      };

      const { error: upErr } = await supabase.from('releases').update(payload).eq('id', relId);
      if (upErr) throw upErr;

      // artists junction
      if (albumArtists.length) {
        const raRows = albumArtists.map((a, idx) => ({
          release_id: relId,
          artist_id: Number(a.id),
          position: idx + 1,
          is_primary: String(a.id) === String(primaryId),
        }));
        await supabase.from('release_artists').delete().eq('release_id', relId);
        const { error: raErr } = await supabase.from('release_artists').insert(raRows);
        if (raErr) throw raErr;
      }

      // similars
      await supabase.from('release_similars').delete().eq('release_id', relId);
      if (similar.length) {
        const rows = similar.map((r, idx) => ({
          release_id: relId,
          similar_release_id: Number(r.id),
          position: idx + 1,
        }));
        const { error: simErr } = await supabase.from('release_similars').insert(rows);
        if (simErr) throw simErr;
      }

      setNote('Saved ✔');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Save failed. Check row-level security for releases/release_artists/release_similars.';
      console.error(e);
      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRelease() {
    if (!relId) return;
    if (!confirm('Delete this release? This cannot be undone.')) return;
    const { error } = await supabase.from('releases').delete().eq('id', relId);
    if (error) { setErr(error.message); return; }
    alert('Release deleted');
    router.push('/admin/releases');
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!relId) return;

    setErr(null);
    setNote(null);
    setSaving(true);

    try {
      const finalSlug = slugify(revSlug || revTitle);
      const payload = {
        kind: 'review' as const,
        title: revTitle.trim(),
        slug: finalSlug,
        excerpt: revExcerpt.trim() || null,
        body: revBody.trim() || null,
        cover_url: revCover.trim() || null,
        featured_slider: !!revFeatured,
        published_at: revPublishNow ? new Date().toISOString() : null,
        release_id: Number(relId),
      };
      const { error } = await supabase.from('articles').insert(payload).single();
      if (error) throw error;

      setRevTitle(''); setRevSlug(''); setRevExcerpt(''); setRevBody('');
      setRevCover(''); setRevFeatured(false); setRevPublishNow(true);

      setNote('Review saved ✔');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not save review (check articles RLS).';
      console.error(e);
      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  // UI
  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking access…</main>;
  if (ok === false) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="mt-2 text-sm opacity-80">You don’t have access.</p>
      </main>
    );
  }
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Album</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/releases" className="text-sm opacity-80 hover:opacity-100 underline">← Back</Link>
          <button onClick={deleteRelease} className="text-sm px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20">
            Delete
          </button>
        </div>
      </div>

      {err && <div className="mb-4 text-sm rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-300">{err}</div>}
      {note && <div className="mb-4 text-sm rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-emerald-300">{note}</div>}

      <form onSubmit={saveRelease} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} required />
        <input className="input" placeholder="Slug (e.g., illmatic)" value={slug} onChange={(e)=>setSlug(e.target.value)} />

        {/* Artists on this album */}
        <div className="sm:col-span-2 rounded-lg border border-zinc-800 p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Artists on this album</h3>
            <span className="text-xs opacity-70">max 3</span>
          </div>

          {albumArtists.length === 0 ? (
            <p className="text-sm opacity-70 mt-2">No artists selected.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {albumArtists.map((a, idx) => (
                <li key={String(a.id)} className="flex items-center gap-2">
                  <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
                          onClick={() => moveArtist(idx, -1)} disabled={idx === 0}>↑</button>
                  <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
                          onClick={() => moveArtist(idx, +1)} disabled={idx === albumArtists.length - 1}>↓</button>

                  <label className="inline-flex items-center gap-2 text-xs">
                    <input type="radio" name="primary-artist" checked={String(primaryId) === String(a.id)} onChange={() => setPrimaryId(a.id)} />
                    Primary
                  </label>

                  <span className="text-sm">{a.name}</span>
                  <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 ml-auto"
                          onClick={() => removeArtist(a.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          {albumArtists.length < 3 && (
            <div className="mt-3">
              <input className="input w-full" placeholder="Search artists to add…" value={artistQuery} onChange={e=>setArtistQuery(e.target.value)} />
              {artistQuery.trim() && matches.length > 0 && (
                <ul className="mt-2 border border-zinc-800 rounded-lg divide-y divide-zinc-800">
                  {matches.map(m => (
                    <li key={String(m.id)} className="flex items-center justify-between px-2 py-1 text-sm">
                      <span>{m.name}</span>
                      <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900"
                              onClick={() => addArtist(m)}>Add</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Staff rating */}
        <input type="number" inputMode="numeric" className="input" placeholder="Staff Rating (50–100)" value={ratingStaff} onChange={(e)=>setRatingStaff(e.target.value)} />

        <input type="number" className="input" placeholder="Year (e.g., 1994)" value={year} onChange={e=>setYear(e.target.value === '' ? '' : parseInt(e.target.value))} />
        <input className="input sm:col-span-1" placeholder="Cover URL" value={cover} onChange={e=>setCover(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="Producers (comma separated)" value={producers} onChange={e=>setProducers(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="Labels (comma separated)" value={labels} onChange={e=>setLabels(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="YouTube ID (optional)" value={youtube} onChange={e=>setYouTube(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="RIAA Cert (e.g., 2× Platinum)" value={riaa} onChange={e=>setRIAA(e.target.value)} />

        <label className="sm:col-span-2 inline-flex items-center gap-2 select-none mt-2">
          <input type="checkbox" checked={isDouble} onChange={e=>setIsDouble(e.target.checked)} />
          <span className="text-sm">Double album (two discs)</span>
        </label>

        {/* Tracklist Disc 1 */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Tracklist — Disc 1</h3>
            <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={addTrack1}>+ Add track</button>
          </div>
          <ul className="space-y-2">
            {tracks1.map((t, i) => (
              <li key={`d1-${i}`} className="flex items-center gap-2">
                <span className="w-6 text-xs opacity-70 tabular-nums">{i+1}.</span>
                <input className="input flex-1" placeholder="Track title" value={t} onChange={e=>setTrack1At(i, e.target.value)} />
                <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={()=>removeTrack1(i)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Tracklist Disc 2 */}
        {isDouble && (
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Tracklist — Disc 2</h3>
              <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={addTrack2}>+ Add track</button>
            </div>
            <ul className="space-y-2">
              {tracks2.map((t, i) => (
                <li key={`d2-${i}`} className="flex items-center gap-2">
                  <span className="w-6 text-xs opacity-70 tabular-nums">{i+1}.</span>
                  <input className="input flex-1" placeholder="Track title" value={t} onChange={e=>setTrack2At(i, e.target.value)} />
                  <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={()=>removeTrack2(i)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Similar albums */}
        <div className="sm:col-span-2 rounded-lg border border-zinc-800 p-3">
          {/* We intentionally relax typing for this multi-select usage */}
          <ReleasePickerAny value={similar} onChange={setSimilar} max={6} label="Similar albums" />
        </div>

        <div className="sm:col-span-2 mt-2">
          <button className="btn" type="submit" disabled={saving || !canSave}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>

      {/* Review editor */}
      <section className="mt-10 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Write a Staff Review</h2>
        <form onSubmit={submitReview} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Review title" value={revTitle} onChange={e=>setRevTitle(e.target.value)} required />
          <input className="input" placeholder="Slug (auto from title if empty)" value={revSlug} onChange={e=>setRevSlug(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="Cover image URL (optional)" value={revCover} onChange={e=>setRevCover(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="Short excerpt (optional)" value={revExcerpt} onChange={e=>setRevExcerpt(e.target.value)} />
          <textarea className="input sm:col-span-2" placeholder="Body (Markdown or plain text)" value={revBody} onChange={e=>setRevBody(e.target.value)} />

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={revFeatured} onChange={e=>setRevFeatured(e.target.checked)} />
            <span className="text-sm">Feature on homepage slider</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={revPublishNow} onChange={e=>setRevPublishNow(e.target.checked)} />
            <span className="text-sm">Publish now</span>
          </label>

          <div className="sm:col-span-2">
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Review'}</button>
          </div>
        </form>
      </section>

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
        textarea.input { min-height: 160px; }
      `}</style>
    </main>
  );
}
