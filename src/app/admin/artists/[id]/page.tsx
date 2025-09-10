'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Artist = {
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
  staff_rank: number | null;     // ordinal
  rating_staff: number | null;   // 50..100
};

export default function EditArtistPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id as string;

  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [a, setA] = useState<Artist | null>(null);

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

  useEffect(() => {
    (async () => {
      const { data: isAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr) { console.error(adminErr); setOk(false); return; }
      setOk(!!isAdmin);

      // Handle BIGINT ids returned as numbers or strings
      const idFilter = Number.isNaN(Number(idParam)) ? idParam : Number(idParam);

      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .eq('id', idFilter)
        .single();

      if (!error && data) {
        const art = data as Artist;
        setA(art);
        setName(art.name || '');
        setSlug(art.slug || '');
        setImg(art.card_img_url || '');
        setOrigin(art.origin || '');
        setYears(art.years_active || '');
        setBio(art.bio || '');
        setHot100(art.billboard_hot100_entries ?? '');
        setPlat(art.platinum ?? '');
        setGrammys(art.grammys ?? '');
        setRank(art.staff_rank ?? '');
        setStaffScore(art.rating_staff != null ? String(art.rating_staff) : '');
      }
      setLoading(false);
    })();
  }, [idParam]);

  if (ok === null) return <main className="mx-auto max-w-3xl p-6">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-3xl p-6">No access.</main>;
  if (loading || !a) return <main className="mx-auto max-w-3xl p-6">Loading…</main>;

  async function handleAvatarUpload(file: File){
    try {
      setUploading(true);
      const safeSlug = (slug || name).toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `artists/${safeSlug}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('assets').upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
      if (pub?.publicUrl) setImg(pub.publicUrl);
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function toIntOrNull(v: number | '') { return v === '' ? null : Number(v); }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    // Clamp rating only on submit (no min/max while typing)
    const parsed = parseInt(staffScore, 10);
    const clampedStaff = Number.isFinite(parsed) ? Math.max(50, Math.min(100, parsed)) : null;

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      card_img_url: img.trim() || null,
      origin: origin.trim() || null,
      years_active: years.trim() || null,
      bio: bio.trim() || null,
      billboard_hot100_entries: toIntOrNull(hot100),
      platinum: toIntOrNull(plat),
      grammys: toIntOrNull(grammys),
      staff_rank: toIntOrNull(rank),
      rating_staff: clampedStaff,
    };

    const { error } = await supabase.from('artists').update(payload).eq('id', a.id);
    if (error) return alert(error.message);
    alert('Saved');
    router.refresh();
  }

  async function remove() {
    if (!confirm('Delete this artist? This cannot be undone.')) return;
    const { error } = await supabase.from('artists').delete().eq('id', a.id);
    if (error) return alert(error.message);
    alert('Deleted');
    router.replace('/admin/artists');
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Edit Artist</h1>
        <Link href="/admin/artists" className="text-sm opacity-80 hover:opacity-100">← Back to list</Link>
      </div>

      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-zinc-800 p-4">
        <input className="input" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} required />
        <input className="input" placeholder="Slug" value={slug} onChange={e=>setSlug(e.target.value)} required />

        {/* Avatar URL + Upload */}
        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
          <input className="input" placeholder="Card image URL" value={img} onChange={e=>setImg(e.target.value)} />
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="file" accept="image/*" className="hidden"
                   onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            <span className={`btn ${uploading ? 'opacity-60' : ''}`}>{uploading ? 'Uploading…' : 'Upload new avatar'}</span>
          </label>
        </div>
        {img && (
          <div className="sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="Avatar" className="h-28 w-28 rounded-lg object-cover border border-zinc-800" />
          </div>
        )}

        <input className="input" placeholder="Origin" value={origin} onChange={e=>setOrigin(e.target.value)} />
        <input className="input" placeholder="Years active" value={years} onChange={e=>setYears(e.target.value)} />
        <textarea className="input sm:col-span-2" placeholder="Short bio" value={bio} onChange={e=>setBio(e.target.value)} />

        <input type="number" className="input" placeholder="Billboard Hot 100 entries"
               value={hot100} onChange={e=>setHot100(e.target.value === '' ? '' : parseInt(e.target.value))} />
        <input type="number" className="input" placeholder="RIAA Platinum Awards"
               value={plat} onChange={e=>setPlat(e.target.value === '' ? '' : parseInt(e.target.value))} />
        <input type="number" className="input" placeholder="Grammys"
               value={grammys} onChange={e=>setGrammys(e.target.value === '' ? '' : parseInt(e.target.value))} />

        <input type="number" className="input" placeholder="Staff Rank (1..N)"
               value={rank} onChange={e=>setRank(e.target.value === '' ? '' : parseInt(e.target.value))} />

        {/* NEW: Staff Rating (free typing, clamp on submit) */}
        <input type="number" inputMode="numeric" className="input sm:col-span-2"
               placeholder="Staff Rating (50–100)"
               value={staffScore} onChange={e=>setStaffScore(e.target.value)} />

        <div className="sm:col-span-2 flex items-center gap-3 pt-2">
          <button type="submit" className="btn">Save</button>
          <button type="button" onClick={remove}
                  className="px-3 py-2 text-sm rounded border border-red-700 text-red-400 hover:bg-red-950/40">
            Delete
          </button>
        </div>
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
        textarea.input { min-height: 110px; }
      `}</style>
    </main>
  );
}
