'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ArtistRow = { id: string | number; name: string; slug: string };

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Ensure a globally-unique release slug by appending -2, -3, ... if needed. */
async function ensureUniqueReleaseSlug(base: string): Promise<string> {
  const clean = base || 'untitled';
  let candidate = clean;
  let n = 2;

  for (let tries = 0; tries < 50; tries++) {
    const { data: rows, error } = await supabase
      .from('releases')
      .select('id')
      .eq('slug', candidate)
      .limit(1);

    if (error) return candidate; // fallback if query fails
    if (!rows || rows.length === 0) return candidate;
    candidate = `${clean}-${n++}`;
  }
  return candidate;
}

/** Loads ALL artists (paged) then filters on the client by name or slug. */
function ArtistPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [all, setAll] = useState<ArtistRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const PAGE = 500;
      let from = 0;
      const acc: ArtistRow[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('artists')
          .select('id,name,slug')
          .order('name', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        if (!data || data.length === 0) break;
        acc.push(...(data as ArtistRow[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (alive) setAll(acc);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const term = q.trim();
    if (!term) return all.slice(0, 2000);
    const tSlug = slugify(term);
    const tLower = term.toLowerCase();
    const res = all.filter((a) => {
      const n = a.name.toLowerCase();
      const s = a.slug.toLowerCase();
      return n.includes(tLower) || s.includes(tSlug) || slugify(a.name).includes(tSlug);
    });
    if (value && !res.find((r) => String(r.id) === String(value))) {
      const cur = all.find((r) => String(r.id) === String(value));
      if (cur) res.unshift(cur);
    }
    return res.slice(0, 2000);
  }, [all, q, value]);

  return (
    <div className="grid gap-2">
      <input
        className="input"
        placeholder="Search artist by name or slug…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="input select-fix"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select artist —</option>
        {shown.map((a) => (
          <option key={String(a.id)} value={String(a.id)}>
            {a.name}
          </option>
        ))}
      </select>
      {loading && <span className="text-xs opacity-70">Loading artists…</span>}
      {!loading && !q && all.length > 2000 && (
        <span className="text-xs opacity-70">Tip: type to narrow the list.</span>
      )}
    </div>
  );
}

type RareClip = { title: string; url: string };

export default function AdminPage() {
  const [ok, setOk] = useState<boolean | null>(null);

  // Artist form state
  const [aName, setAName] = useState('');
  const [aSlug, setASlug] = useState('');
  const [aImg, setAImg] = useState(''); // public URL
  const [aOrigin, setAOrigin] = useState('');
  const [aYears, setAYears] = useState('');
  const [aBio, setABio] = useState('');
  const [aHot100, setAHot100] = useState<number | ''>('');
  const [aPlatinum, setAPlatinum] = useState<number | ''>('');
  const [aGrammys, setAGrammys] = useState<number | ''>('');
  const [aStaffRank, setAStaffRank] = useState<number | ''>('');
  const [aStaffScore, setAStaffScore] = useState<string>('');
  // Artist SEO
  const [aSeoTitle, setASeoTitle] = useState('');
  const [aSeoDesc, setASeoDesc] = useState('');
  // Long-form bio sections
  const [aBioIntro, setABioIntro] = useState('');
  const [aBioEarly, setABioEarly] = useState('');
  const [aBioMixtapes, setABioMixtapes] = useState('');
  const [aBioAlbums, setABioAlbums] = useState('');
  const [aBioBusiness, setABioBusiness] = useState('');
  const [aBioLegacy, setABioLegacy] = useState('');
  const [aBioSources, setABioSources] = useState('');
  // Rare Clips (dynamic)
  const [rareClips, setRareClips] = useState<RareClip[]>([{ title: '', url: '' }]);
  const [uploading, setUploading] = useState(false);

  // Release form state
  const [rTitle, setRTitle] = useState('');
  const [rSlug, setRSlug] = useState('');
  const [rArtistId, setRArtistId] = useState<string>(''); // from ArtistPicker
  const [rYear, setRYear] = useState<number | ''>('');
  const [rCover, setRCover] = useState('');
  const [rProducers, setRProducers] = useState('');
  const [rLabels, setRLabels] = useState('');
  const [rYouTube, setRYouTube] = useState('');
  const [rRIAA, setRRIAA] = useState(''); // RIAA cert text
  const [rDouble, setRDouble] = useState(false);
  const [tracks1, setTracks1] = useState<string[]>(['']);
  const [tracks2, setTracks2] = useState<string[]>(['']);
  // Release SEO
  const [rSeoTitle, setRSeoTitle] = useState('');
  const [rSeoDesc, setRSeoDesc] = useState('');
  // Similar albums (comma-separated slugs)
  const [rSimilar, setRSimilar] = useState('');

  useEffect(() => {
    (async () => {
      const { data: meAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr) {
        console.error(adminErr);
        setOk(false);
        return;
      }
      setOk(!!meAdmin);
    })();
  }, []);

  useEffect(() => {
    if (!aName || aSlug) return;
    setASlug(slugify(aName));
  }, [aName, aSlug]);

  useEffect(() => {
    if (!rTitle || rSlug) return;
    setRSlug(slugify(rTitle));
  }, [rTitle, rSlug]);

  const canUpload = !!aSlug;

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking access…</main>;
  if (ok === false)
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="mt-2 text-sm opacity-80">You don’t have access.</p>
      </main>
    );

  const toArray = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const toIntOrNull = (v: number | '') => (v === '' ? null : Number(v));

  async function handleAvatarUpload(file: File) {
    try {
      setUploading(true);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `artists/${aSlug}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
      if (pub?.publicUrl) setAImg(pub.publicUrl);
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // ----- tracklist helpers -----
  const addTrack1 = () => setTracks1((prev) => [...prev, '']);
  const addTrack2 = () => setTracks2((prev) => [...prev, '']);
  const removeTrack1 = (i: number) =>
    setTracks1((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));
  const removeTrack2 = (i: number) =>
    setTracks2((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));
  const setTrack1At = (i: number, v: string) =>
    setTracks1((prev) => prev.map((t, idx) => (idx === i ? v : t)));
  const setTrack2At = (i: number, v: string) =>
    setTracks2((prev) => prev.map((t, idx) => (idx === i ? v : t)));

  // ----- rare clips helpers -----
  function addRareClip() {
    setRareClips((prev) => [...prev, { title: '', url: '' }]);
  }
  function removeRareClip(i: number) {
    setRareClips((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function setRareClipAt(i: number, part: Partial<RareClip>) {
    setRareClips((prev) => prev.map((rc, idx) => (idx === i ? { ...rc, ...part } : rc)));
  }

  async function addArtist(e: React.FormEvent) {
    e.preventDefault();

    // clamp staff rating only on submit
    const parsed = parseInt(aStaffScore, 10);
    const staffScore = Number.isFinite(parsed) ? Math.max(50, Math.min(100, parsed)) : null;

    const payload = {
      name: aName.trim(),
      slug: slugify(aSlug || aName),
      card_img_url: aImg.trim() || null,
      origin: aOrigin.trim() || null,
      years_active: aYears.trim() || null,
      bio: aBio.trim() || null,
      billboard_hot100_entries: toIntOrNull(aHot100),
      platinum: toIntOrNull(aPlatinum),
      grammys: toIntOrNull(aGrammys),
      staff_rank: toIntOrNull(aStaffRank),
      rating_staff: staffScore,
      // SEO
      seo_title: aSeoTitle.trim() || null,
      seo_description: aSeoDesc.trim() || null,
      // long form
      bio_long_intro: aBioIntro.trim() || null,
      bio_long_early: aBioEarly.trim() || null,
      bio_long_mixtapes: aBioMixtapes.trim() || null,
      bio_long_albums: aBioAlbums.trim() || null,
      bio_long_business: aBioBusiness.trim() || null,
      bio_long_legacy: aBioLegacy.trim() || null,
      bio_sources: aBioSources.trim() || null,
      // rare clips
      rare_clips: rareClips
        .map((rc) => ({ title: rc.title.trim(), url: rc.url.trim() }))
        .filter((rc) => rc.title || rc.url),
    };

    const { error } = await supabase.from('artists').insert(payload);
    if (error) return alert(error.message);

    alert('Artist added');

    // reset (core + new fields)
    setAName(''); setASlug(''); setAImg(''); setAOrigin(''); setAYears(''); setABio('');
    setAHot100(''); setAPlatinum(''); setAGrammys(''); setAStaffRank('');
    setAStaffScore(''); setASeoTitle(''); setASeoDesc('');
    setABioIntro(''); setABioEarly(''); setABioMixtapes(''); setABioAlbums('');
    setABioBusiness(''); setABioLegacy(''); setABioSources('');
    setRareClips([{ title: '', url: '' }]);
  }

  async function addRelease(e: React.FormEvent) {
    e.preventDefault();

    // Build a base slug from the field or title, then auto-dedupe to avoid unique violations
    const baseSlug = slugify(rSlug || rTitle) || 'untitled';
    const finalSlug = await ensureUniqueReleaseSlug(baseSlug);

    // Track arrays (strip empties)
    const disc1 = tracks1.map((t) => t.trim()).filter(Boolean);
    const disc2 = tracks2.map((t) => t.trim()).filter(Boolean);

    // IMPORTANT: if your DB column `tracks_disc1` is NOT NULL, send [] (not null)
    const tracksPayload = {
      tracks_disc1: disc1.length ? disc1 : [],
      tracks_disc2: rDouble ? (disc2.length ? disc2 : []) : null,
    };

    const similar_release_slugs = toArray(rSimilar);

    const base = {
      title: rTitle.trim(),
      slug: finalSlug,
      artist_id: rArtistId || null,
      year: rYear === '' ? null : rYear,
      cover_url: rCover.trim() || null,
      producers: toArray(rProducers),
      labels: toArray(rLabels),
      youtube_id: rYouTube.trim() || null,
      is_double_album: rDouble,
      riaa_cert: rRIAA.trim() || null,
      // SEO
      seo_title: rSeoTitle.trim() || null,
      seo_description: rSeoDesc.trim() || null,
      // Similar albums (slugs)
      similar_release_slugs,
      ...tracksPayload,
    };

    const { error: insErr } = await supabase.from('releases').insert(base);
    if (insErr) {
      alert(insErr.message || 'Could not add release.');
      return;
    }

    alert('Release added');

    // reset
    setRTitle(''); setRSlug(''); setRArtistId(''); setRYear(''); setRCover('');
    setRProducers(''); setRLabels(''); setRYouTube(''); setRRIAA(''); setRDouble(false);
    setTracks1(['']); setTracks2(['']); setRSeoTitle(''); setRSeoDesc(''); setRSimilar('');
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
        <nav className="text-sm flex flex-wrap gap-3">
          <a href="/admin/artists" className="opacity-80 hover:opacity-100 underline">
            Manage Artists →
          </a>
          <a href="/admin/releases" className="opacity-80 hover:opacity-100 underline">
            Manage Albums →
          </a>
          <a href="/admin/producers" className="opacity-80 hover:opacity-100 underline">
            Manage Producers →
          </a>
          <a href="/admin/articles" className="opacity-80 hover:opacity-100 underline">
            Articles Admin →
          </a>
          {/* 🔁 changed to /admin/articles so it won’t 404 */}
          <a href="/admin/articles" className="opacity-80 hover:opacity-100 underline">
            Reviews Admin →
          </a>
          <a href="/admin/calendar" className="opacity-80 hover:opacity-100 underline">
            Manage Calendar →
          </a>
          <a href="/admin/today" className="opacity-80 hover:opacity-100 underline">
            Manage Today in Hip-Hop →
          </a>
          <a href="/admin/debates" className="opacity-80 hover:opacity-100 underline">
            Manage Debates →
          </a>
          <a href="/admin/verse" className="opacity-80 hover:opacity-100 underline">
            Verse of the Month →
          </a>
        </nav>
      </div>
      <p className="text-sm opacity-80 mb-6">
        Add artists and releases. Only your account can write.
      </p>

      {/* Add Artist */}
      <section className="mb-8 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Add Artist</h2>
        <form onSubmit={addArtist} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Name" value={aName} onChange={(e) => setAName(e.target.value)} required />
          <input className="input" placeholder="Slug (e.g., nas)" value={aSlug} onChange={(e) => setASlug(e.target.value)} required />

          {/* Avatar upload + preview */}
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
            <input className="input" placeholder="Card image URL (optional)" value={aImg} onChange={(e) => setAImg(e.target.value)} />
            <label className={`inline-flex items-center gap-2 ${!canUpload ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!canUpload || uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                }}
              />
              <span className="btn">{uploading ? 'Uploading…' : 'Upload avatar'}</span>
            </label>
          </div>
          {aImg && (
            <div className="sm:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={aImg} alt="Artist avatar preview" className="h-28 w-28 rounded-lg object-cover border border-zinc-800" />
            </div>
          )}

          <input className="input" placeholder="Origin (e.g., Queensbridge, NY)" value={aOrigin} onChange={(e) => setAOrigin(e.target.value)} />
          <input className="input" placeholder="Years active (e.g., 1991–present)" value={aYears} onChange={(e) => setAYears(e.target.value)} />
          <textarea className="input sm:col-span-2" placeholder="Short teaser bio (2–3 sentences)" value={aBio} onChange={(e) => setABio(e.target.value)} />

          {/* Achievements */}
          <input type="number" className="input" placeholder="Billboard Hot 100 entries" value={aHot100} onChange={(e) => setAHot100(e.target.value === '' ? '' : parseInt(e.target.value))} />
          <input type="number" className="input" placeholder="RIAA Platinum Awards" value={aPlatinum} onChange={(e) => setAPlatinum(e.target.value === '' ? '' : parseInt(e.target.value))} />
          <input type="number" className="input" placeholder="Grammys" value={aGrammys} onChange={(e) => setAGrammys(e.target.value === '' ? '' : parseInt(e.target.value))} />

          {/* Staff rating + rank */}
          <input type="number" inputMode="numeric" className="input" placeholder="Staff Rating (50–100)" value={aStaffScore} onChange={(e) => setAStaffScore(e.target.value)} />
          <input type="number" className="input" placeholder="Staff Rank (e.g., 37) — leave blank if undecided" value={aStaffRank} onChange={(e) => setAStaffRank(e.target.value === '' ? '' : parseInt(e.target.value))} />

          {/* SEO for Artist */}
          <input className="input sm:col-span-2" placeholder="SEO Title (optional)" value={aSeoTitle} onChange={(e) => setASeoTitle(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="SEO Description (optional)" value={aSeoDesc} onChange={(e) => setASeoDesc(e.target.value)} />

          {/* Long-form Bio sections */}
          <div className="sm:col-span-2 mt-2 grid gap-3">
            <h3 className="text-sm font-semibold">Long-form Bio</h3>
            <textarea className="input" placeholder="Intro / Overview" value={aBioIntro} onChange={(e) => setABioIntro(e.target.value)} />
            <textarea className="input" placeholder="Early life / Origins" value={aBioEarly} onChange={(e) => setABioEarly(e.target.value)} />
            <textarea className="input" placeholder="Mixtape era / Sqad Up / dedications" value={aBioMixtapes} onChange={(e) => setABioMixtapes(e.target.value)} />
            <textarea className="input" placeholder="Albums / Breakthroughs" value={aBioAlbums} onChange={(e) => setABioAlbums(e.target.value)} />
            <textarea className="input" placeholder="Business / Young Money / ventures" value={aBioBusiness} onChange={(e) => setABioBusiness(e.target.value)} />
            <textarea className="input" placeholder="Legacy / Influence" value={aBioLegacy} onChange={(e) => setABioLegacy(e.target.value)} />
            <textarea className="input" placeholder="Sources (comma separated or free text)" value={aBioSources} onChange={(e) => setABioSources(e.target.value)} />
          </div>

          {/* Rare Clips */}
          <div className="sm:col-span-2 mt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Rare Clips</h3>
              <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={addRareClip}>
                + Add clip
              </button>
            </div>
            <ul className="space-y-2">
              {rareClips.map((rc, i) => (
                <li key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input className="input" placeholder="Title (e.g., 2004 radio freestyle)" value={rc.title} onChange={(e) => setRareClipAt(i, { title: e.target.value })} />
                  <input className="input" placeholder="URL (YouTube/Vimeo/etc.)" value={rc.url} onChange={(e) => setRareClipAt(i, { url: e.target.value })} />
                  <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={() => removeRareClip(i)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button className="btn sm:col-span-2 mt-2" type="submit">
            Save Artist
          </button>
        </form>
      </section>

      {/* Add Release */}
      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Add Release</h2>
        <form onSubmit={addRelease} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Title" value={rTitle} onChange={(e) => setRTitle(e.target.value)} required />
          <input className="input" placeholder="Slug (e.g., illmatic)" value={rSlug} onChange={(e) => setRSlug(e.target.value)} />

          {/* Artist type-ahead */}
          <div className="sm:col-span-2">
            <ArtistPicker value={rArtistId} onChange={setRArtistId} />
          </div>

          <input type="number" className="input" placeholder="Year (e.g., 1994)" value={rYear} onChange={(e) => setRYear(e.target.value === '' ? '' : parseInt(e.target.value))} />
          <input className="input sm:col-span-2" placeholder="Cover URL" value={rCover} onChange={(e) => setRCover(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="Producers (comma separated)" value={rProducers} onChange={(e) => setRProducers(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="Labels (comma separated)" value={rLabels} onChange={(e) => setRLabels(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="YouTube ID (optional)" value={rYouTube} onChange={(e) => setRYouTube(e.target.value)} />

          {/* RIAA Cert */}
          <input className="input sm:col-span-2" placeholder="RIAA Cert (e.g., 2× Platinum)" value={rRIAA} onChange={(e) => setRRIAA(e.target.value)} />

          {/* Double album toggle */}
          <label className="sm:col-span-2 inline-flex items-center gap-2 select-none">
            <input type="checkbox" checked={rDouble} onChange={(e) => setRDouble(e.target.checked)} />
            <span className="text-sm">Double album (two discs)</span>
          </label>

          {/* Tracklist — Disc 1 */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Tracklist — Disc 1</h3>
              <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={addTrack1}>
                + Add track
              </button>
            </div>
            <ul className="space-y-2">
              {tracks1.map((t, i) => (
                <li key={`d1-${i}`} className="flex items-center gap-2">
                  <span className="w-6 text-xs opacity-70 tabular-nums">{i + 1}.</span>
                  <input className="input flex-1" placeholder="Track title" value={t} onChange={(e) => setTrack1At(i, e.target.value)} />
                  <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={() => removeTrack1(i)} title="Remove track">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Tracklist — Disc 2 (only if double) */}
          {rDouble && (
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Tracklist — Disc 2</h3>
                <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={addTrack2}>
                  + Add track
                </button>
              </div>
              <ul className="space-y-2">
                {tracks2.map((t, i) => (
                  <li key={`d2-${i}`} className="flex items-center gap-2">
                    <span className="w-6 text-xs opacity-70 tabular-nums">{i + 1}.</span>
                    <input className="input flex-1" placeholder="Track title" value={t} onChange={(e) => setTrack2At(i, e.target.value)} />
                    <button type="button" className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900" onClick={() => removeTrack2(i)} title="Remove track">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* SEO for Release */}
          <input className="input sm:col-span-2" placeholder="SEO Title (optional)" value={rSeoTitle} onChange={(e) => setRSeoTitle(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="SEO Description (optional)" value={rSeoDesc} onChange={(e) => setRSeoDesc(e.target.value)} />

          {/* Similar Albums */}
          <input
            className="input sm:col-span-2"
            placeholder="Similar album slugs (comma separated)"
            value={rSimilar}
            onChange={(e) => setRSimilar(e.target.value)}
          />

          <button className="btn sm:col-span-2" type="submit">
            Save Release
          </button>
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
        .input::placeholder {
          color: #a1a1aa;
        }
        .input:focus {
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.35);
        }

        /* Force readable colors for native <select> popup and its options */
        select.input.select-fix {
          color: #f4f4f5;
          background: #0a0a0a;
        }
        select.input.select-fix option {
          color: #0a0a0a !important;
          background: #ffffff !important;
        }

        .btn {
          background: #f97316;
          color: #000;
          font-weight: 700;
          border-radius: 0.5rem;
          padding: 0.6rem 0.9rem;
        }
        textarea.input {
          min-height: 110px;
        }
      `}</style>
    </main>
  );
}
