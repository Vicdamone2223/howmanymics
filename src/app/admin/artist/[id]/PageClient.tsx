'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ArtistRow = {
  id: string | number;
  name: string;
  slug: string;
  card_img_url: string | null;
  origin: string | null;
  years_active: string | null;
  bio: string | null;
  billboard_hot100_entries: number | null;
  platinum: number | null;
  grammys: number | null;
  staff_rank: number | null;
  rating_staff: number | null;

  // SEO + Long-form
  seo_title: string | null;
  seo_description: string | null;

  bio_long_intro: string | null;
  bio_long_early: string | null;
  bio_long_mixtapes: string | null;
  bio_long_albums: string | null;
  bio_long_business: string | null;
  bio_long_legacy: string | null;
  bio_sources: string | null;
};

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function EditArtistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [a, setA] = useState<ArtistRow | null>(null);

  // local editable fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [img, setImg] = useState('');
  const [origin, setOrigin] = useState('');
  const [years, setYears] = useState('');
  const [bio, setBio] = useState('');
  const [hot100, setHot100] = useState<number | ''>('');
  const [plat, setPlat] = useState<number | ''>('');
  const [grammys, setGrammys] = useState<number | ''>('');
  const [rank, setRank] = useState<number | ''>('');
  const [staffScore, setStaffScore] = useState<string>(''); // free typing

  // SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');

  // Long-form bio sections
  const [bioIntro, setBioIntro] = useState('');
  const [bioEarly, setBioEarly] = useState('');
  const [bioMix, setBioMix] = useState('');
  const [bioAlbums, setBioAlbums] = useState('');
  const [bioBiz, setBioBiz] = useState('');
  const [bioLegacy, setBioLegacy] = useState('');
  const [bioSources, setBioSources] = useState('');

  useEffect(() => {
    (async () => {
      const { data: isAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr || !isAdmin) { setOk(false); return; }
      setOk(true);

      // accept either numeric id or slug
      const maybeNum = Number(id);
      let row: ArtistRow | null = null;

      if (!Number.isNaN(maybeNum)) {
        const { data, error } = await supabase.from('artists').select('*').eq('id', maybeNum).single();
        if (!error && data) row = data as ArtistRow;
      }
      if (!row) {
        const { data, error } = await supabase.from('artists').select('*').eq('slug', id).single();
        if (!error && data) row = data as ArtistRow;
      }

      if (!row) {
        setLoading(false);
        alert('Artist not found');
        router.replace('/admin/artist');
        return;
      }

      setA(row);

      setName(row.name || '');
      setSlug(row.slug || '');
      setImg(row.card_img_url || '');
      setOrigin(row.origin || '');
      setYears(row.years_active || '');
      setBio(row.bio || '');
      setHot100(row.billboard_hot100_entries ?? '');
      setPlat(row.platinum ?? '');
      setGrammys(row.grammys ?? '');
      setRank(row.staff_rank ?? '');
      setStaffScore(row.rating_staff != null ? String(row.rating_staff) : '');

      setSeoTitle(row.seo_title || '');
      setSeoDesc(row.seo_description || '');

      setBioIntro(row.bio_long_intro || '');
      setBioEarly(row.bio_long_early || '');
      setBioMix(row.bio_long_mixtapes || '');
      setBioAlbums(row.bio_long_albums || '');
      setBioBiz(row.bio_long_business || '');
      setBioLegacy(row.bio_long_legacy || '');
      setBioSources(row.bio_sources || '');

      setLoading(false);
    })();
  }, [id, router]);

  if (ok === null) return <main className="mx-auto max-w-3xl p-6">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-3xl p-6">No access.</main>;
  if (loading || !a) return <main className="mx-auto max-w-3xl p-6">Loading…</main>;

  async function handleAvatarUpload(file: File) {
    try {
      setUploading(true);
      const safeSlug = slugify(slug || name) || 'artist';
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `artists/${safeSlug}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('assets').upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
      if (pub?.publicUrl) setImg(pub.publicUrl);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      alert(message);
    } finally {
      setUploading(false);
    }
  }

  const toIntOrNull = (v: number | '') => (v === '' ? null : Number(v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!a) return;

    // clamp rating only on submit
    const parsed = parseInt(staffScore, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(50, Math.min(100, parsed)) : null;

    const payload = {
      name: name.trim(),
      slug: slugify(slug || name),
      card_img_url: img.trim() || null,
      origin: origin.trim() || null,
      years_active: years.trim() || null,
      bio: bio.trim() || null,
      billboard_hot100_entries: toIntOrNull(hot100),
      platinum: toIntOrNull(plat),
      grammys: toIntOrNull(grammys),
      staff_rank: toIntOrNull(rank),
      rating_staff: clamped,

      // SEO
      seo_title: seoTitle.trim() || null,
      seo_description: seoDesc.trim() || null,

      // Long-form
      bio_long_intro: bioIntro.trim() || null,
      bio_long_early: bioEarly.trim() || null,
      bio_long_mixtapes: bioMix.trim() || null,
      bio_long_albums: bioAlbums.trim() || null,
      bio_long_business: bioBiz.trim() || null,
      bio_long_legacy: bioLegacy.trim() || null,
      bio_sources: bioSources.trim() || null,
    };

    const { error } = await supabase.from('artists').update(payload).eq('id', a.id);
    if (error) return alert(error.message);
    alert('Saved');
    router.refresh();
  }

  async function remove() {
    if (!a) return;
    if (!confirm('Delete this artist? This cannot be undone.')) return;
    const { error } = await supabase.from('artists').delete().eq('id', a.id);
    if (error) return alert(error.message);
    alert('Deleted');
    router.replace('/admin/artist');
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Edit Artist</h1>
        <Link href="/admin/artist" className="text-sm opacity-80 hover:opacity-100">← Back to list</Link>
      </div>

      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-zinc-800 p-4">
        <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="input" placeholder="Slug" value={slug} onChange={e => setSlug(e.target.value)} required />

        {/* Avatar URL + Upload */}
        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
          <input className="input" placeholder="Card image URL" value={img} onChange={e => setImg(e.target.value)} />
          <label className={`inline-flex items-center gap-2 ${uploading ? 'opacity-60' : ''} cursor-pointer`}>
            <input type="file" accept="image/*" className="hidden"
                   onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            <span className="btn">{uploading ? 'Uploading…' : 'Upload new avatar'}</span>
          </label>
        </div>
        {img && (
          <div className="sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="Avatar" className="h-28 w-28 rounded-lg object-cover border border-zinc-800" />
          </div>
        )}

        <input className="input" placeholder="Origin" value={origin} onChange={e => setOrigin(e.target.value)} />
        <input className="input" placeholder="Years active" value={years} onChange={e => setYears(e.target.value)} />
        <textarea className="input sm:col-span-2" placeholder="Short bio" value={bio} onChange={e => setBio(e.target.value)} />

        <input
          type="number"
          className="input"
          placeholder="Billboard Hot 100 entries"
          value={hot100}
          onChange={e => setHot100(e.target.value === '' ? '' : parseInt(e.target.value))}
        />
        <input
          type="number"
          className="input"
          placeholder="RIAA Platinum Awards"
          value={plat}
          onChange={e => setPlat(e.target.value === '' ? '' : parseInt(e.target.value))}
        />
        <input
          type="number"
          className="input"
          placeholder="Grammys"
          value={grammys}
          onChange={e => setGrammys(e.target.value === '' ? '' : parseInt(e.target.value))}
        />

        <input
          type="number"
          className="input"
          placeholder="Staff Rank (1..N)"
          value={rank}
          onChange={e => setRank(e.target.value === '' ? '' : parseInt(e.target.value))}
        />

        {/* Staff rating (free typing, clamp on submit) */}
        <input
          type="number"
          inputMode="numeric"
          className="input sm:col-span-2"
          placeholder="Staff Rating (50–100)"
          value={staffScore}
          onChange={e => setStaffScore(e.target.value)}
        />

        {/* SEO */}
        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3 mt-2">
          <input className="input" placeholder="SEO Title (optional)" value={seoTitle} onChange={e => setSeoTitle(e.target.value)} />
          <input className="input" placeholder="SEO Description (optional)" value={seoDesc} onChange={e => setSeoDesc(e.target.value)} />
        </div>

        {/* Long-form sections */}
        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3 mt-2">
          <label className="block">
            <div className="text-xs opacity-70 mb-1">Intro / Overview</div>
            <textarea className="input" value={bioIntro} onChange={e => setBioIntro(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs opacity-70 mb-1">Early life & come-up</div>
            <textarea className="input" value={bioEarly} onChange={e => setBioEarly(e.target.value)} />
          </label>
        </div>

        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs opacity-70 mb-1">Mixtape era</div>
            <textarea className="input" value={bioMix} onChange={e => setBioMix(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs opacity-70 mb-1">Albums & runs</div>
            <textarea className="input" value={bioAlbums} onChange={e => setBioAlbums(e.target.value)} />
          </label>
        </div>

        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs opacity-70 mb-1">Business & label</div>
            <textarea className="input" value={bioBiz} onChange={e => setBioBiz(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs opacity-70 mb-1">Legacy & influence</div>
            <textarea className="input" value={bioLegacy} onChange={e => setBioLegacy(e.target.value)} />
          </label>
        </div>

        <label className="sm:col-span-2 block">
          <div className="text-xs opacity-70 mb-1">Sources (one URL per line)</div>
          <textarea className="input" value={bioSources} onChange={e => setBioSources(e.target.value)} />
        </label>

        <div className="sm:col-span-2 flex items-center gap-3 pt-2">
          <button type="submit" className="btn">Save</button>
          <button
            type="button"
            onClick={remove}
            className="px-3 py-2 text-sm rounded border border-red-700 text-red-400 hover:bg-red-950/40"
          >
            Delete
          </button>
        </div>
      </form>

      <style jsx>{`
        .input { background:#0a0a0a; border:1px solid #27272a; border-radius:0.5rem; padding:0.5rem 0.75rem; color:#f4f4f5; outline:none; }
        .input::placeholder { color:#a1a1aa; }
        .input:focus { box-shadow: 0 0 0 2px rgba(249,115,22,0.35); }
        .btn { background:#f97316; color:#000; font-weight:700; border-radius:0.5rem; padding:0.6rem 0.9rem; }
        textarea.input { min-height: 110px; }
      `}</style>
    </main>
  );
}
