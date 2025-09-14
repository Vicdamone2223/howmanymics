// src/app/artist/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SeoJsonLd from '@/components/SeoJsonLd';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { absUrl, SITE_NAME } from '@/lib/seo';

// ---- Server-side metadata (runs before client component) ----
const supaForMeta = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { data } = await supaForMeta
    .from('artists')
    .select('name,slug,card_img_url,meta_title,meta_description,og_image,noindex')
    .eq('slug', params.slug)
    .single();

  if (!data) return { title: 'Artist not found' };

  const title = data.meta_title || `${data.name} • Artist profile`;
  const description =
    data.meta_description ||
    `Discover discography, stats and rankings for ${data.name} on ${SITE_NAME}.`;
  const image = data.og_image || data.card_img_url || '/placeholder/nas-card.jpg';

  return {
    title,
    description,
    alternates: { canonical: absUrl(`/artist/${data.slug}`) },
    openGraph: {
      title,
      description,
      url: absUrl(`/artist/${data.slug}`),
      images: [{ url: absUrl(image) }],
      type: 'profile',
    },
    twitter: {
      title,
      description,
      images: [absUrl(image)],
      card: 'summary_large_image',
    },
    robots: data.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

// ---- Types used by the client component ----
type Artist = {
  id: number | string;
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
  rating_staff?: number | null;
};

type ReleaseRow = {
  id: number | string;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
  release_ratings?: { rating: number }[];
};

type MyRating = { rating: number; id: string };

export default function ArtistPage() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [releases, setReleases] = useState<(ReleaseRow & { people_avg: number | null })[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [myRating, setMyRating] = useState<MyRating | null>(null);
  const [peopleAvg, setPeopleAvg] = useState<number | null>(null);
  const [inputRating, setInputRating] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const email = sess.session?.user?.email ?? null;
      setSessionEmail(email);

      const { data: a } = await supabase
        .from('artists')
        .select('id,name,slug,card_img_url,origin,years_active,bio,billboard_hot100_entries,platinum,grammys,staff_rank,rating_staff')
        .eq('slug', slug)
        .single();

      if (!a) { setLoading(false); setArtist(null); return; }
      setArtist(a as Artist);

      // People average from artist_ratings(score)
      {
        const { data: avgRows } = await supabase
          .from('artist_ratings')
          .select('score')
          .eq('artist_id', a.id);

        if (avgRows?.length) {
          const nums = avgRows.map((r: any) => Number(r.score)).filter((n: any) => Number.isFinite(n));
          setPeopleAvg(nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null);
        } else setPeopleAvg(null);
      }

      // My rating (if signed in)
      if (email) {
        const { data: mine } = await supabase
          .from('artist_ratings')
          .select('id,score')
          .eq('artist_id', a.id)
          .limit(1);

        if (mine?.length) {
          setMyRating({ id: mine[0].id, rating: mine[0].score });
          setInputRating(String(mine[0].score));
        } else {
          setMyRating(null);
          setInputRating('');
        }
      }

      // --- Discography: merge junction + legacy source ---
      const baseSelect = 'id,title,slug,cover_url,year,rating_staff,release_ratings(rating)';

      // Via junction (primary or secondary)
      const { data: viaJunction } = await supabase
        .from('releases')
        .select(`${baseSelect},release_artists!inner(artist_id)`)
        .eq('release_artists.artist_id', a.id);

      // Legacy (direct artist_id)
      const { data: viaLegacy } = await supabase
        .from('releases')
        .select(baseSelect)
        .eq('artist_id', a.id);

      const map = new Map<number | string, any>();
      for (const r of (viaJunction || [])) map.set(r.id, r);
      for (const r of (viaLegacy || []))   map.set(r.id, map.get(r.id) || r);

      const combined = Array.from(map.values()).sort((x, y) => {
        const ax = x.year ?? 9999, ay = y.year ?? 9999;
        return ax - ay;
      });

      const withAverages = combined.map((r: any) => {
        const arr = Array.isArray(r.release_ratings) ? r.release_ratings : [];
        const nums = arr.map((x: any) => Number(x.rating)).filter(Number.isFinite);
        const avg  = nums.length
          ? Math.round(nums.reduce((sum: number, n: number) => sum + n, 0) / nums.length)
          : null;
        return { id: r.id, title: r.title, slug: r.slug, cover_url: r.cover_url, year: r.year, rating_staff: r.rating_staff ?? null, people_avg: avg };
      });

      setReleases(withAverages);
      setLoading(false);
    })();
  }, [slug]);

  const overallScore = useMemo(() => {
    const staff = artist?.rating_staff ?? null;
    const ppl   = peopleAvg ?? null;
    if (staff == null && ppl == null) return null;
    if (staff != null && ppl == null) return Math.round(staff);
    if (staff == null && ppl != null) return Math.round(ppl);
    return Math.round(0.5 * Number(staff) + 0.5 * Number(ppl));
  }, [artist?.rating_staff, peopleAvg]);

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!artist) return;
    const parsed = parseInt(inputRating, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(50, Math.min(100, parsed)) : NaN;
    if (Number.isNaN(clamped)) return alert('Please enter a number from 50 to 100.');

    setSaving(true);
    try {
      if (myRating) {
        const { error } = await supabase
          .from('artist_ratings')
          .update({ score: clamped })
          .eq('id', myRating.id);
        if (error) throw error;
        setMyRating({ id: myRating.id, rating: clamped });
      } else {
        const { data, error } = await supabase
          .from('artist_ratings')
          .insert({ artist_id: artist.id, score: clamped })
          .select('id,score')
          .single();
        if (error) throw error;
        setMyRating({ id: data.id, rating: data.score });
      }

      const { data: avgRows } = await supabase
        .from('artist_ratings')
        .select('score')
        .eq('artist_id', artist.id);

      if (avgRows?.length) {
        const nums = avgRows.map((r: any) => Number(r.score)).filter(Number.isFinite);
        setPeopleAvg(nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null);
      } else setPeopleAvg(null);

      alert('Saved your rating.');
    } catch (err: any) {
      alert(err.message || 'Could not save rating.');
    } finally {
      setSaving(false);
    }
  }

  async function removeMyRating() {
    if (!artist || !myRating) return;
    if (!confirm('Remove your rating?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('artist_ratings')
        .delete()
        .eq('id', myRating.id);
      if (error) throw error;

      setMyRating(null);
      setInputRating('');

      const { data: avgRows } = await supabase
        .from('artist_ratings')
        .select('score')
        .eq('artist_id', artist.id);

      if (avgRows?.length) {
        const nums = avgRows.map((r: any) => Number(r.score)).filter(Number.isFinite);
        setPeopleAvg(nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null);
      } else setPeopleAvg(null);
    } catch (err: any) {
      alert(err.message || 'Could not remove rating.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>;
  if (!artist) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* JSON-LD */}
      <SeoJsonLd
        json={{
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          name: artist.name,
          url: absUrl(`/artist/${artist.slug}`),
          image: artist.card_img_url ? absUrl(artist.card_img_url) : undefined,
          aggregateRating:
            overallScore != null
              ? { '@type': 'AggregateRating', ratingValue: overallScore, ratingCount: 1 }
              : undefined,
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artist!.card_img_url || '/placeholder/nas-card.jpg'}
          alt={artist!.name}
          className="h-36 w-36 rounded-xl object-cover border border-zinc-800"
        />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold">{artist!.name}</h1>
            {artist!.staff_rank && (
              <span className="text-xs px-2 py-1 rounded bg-orange-500/15 border border-orange-500/30 text-orange-300">
                Rank #{artist!.staff_rank}
              </span>
            )}
          </div>
          <div className="mt-2 text-sm opacity-80">
            {artist!.origin && <span>{artist!.origin}</span>}
            {artist!.origin && artist!.years_active && <span> • </span>}
            {artist!.years_active && <span>{artist!.years_active}</span>}
          </div>
          {artist!.bio && <p className="mt-3 opacity-90 max-w-2xl">{artist!.bio}</p>}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Chip label="Hot 100 entries" value={artist!.billboard_hot100_entries} />
            <Chip label="Platinum awards" value={artist!.platinum} />
            <Chip label="Grammys" value={artist!.grammys} />
          </div>
          {overallScore != null && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1">
              <span className="opacity-70">Overall</span>
              <strong className="tabular-nums">{overallScore}</strong>
            </div>
          )}
          {sessionEmail ? (
            <form onSubmit={submitRating} className="mt-4 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                className="input w-28"
                placeholder="Rate 50–100"
                value={inputRating}
                onChange={(e) => setInputRating(e.target.value)}
              />
              <button className="btn" disabled={saving} type="submit">
                {myRating ? 'Update' : 'Submit'}
              </button>
              {myRating && (
                <button
                  type="button"
                  onClick={removeMyRating}
                  className="text-xs px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-900"
                  disabled={saving}
                >
                  Remove
                </button>
              )}
            </form>
          ) : (
            <div className="mt-3 text-xs opacity-75">
              <a href="/login" className="underline">Sign in</a> to rate this artist.
            </div>
          )}
        </div>
      </div>

      {/* Discography */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-3">Discography</h2>
        {releases.length === 0 ? (
          <p className="opacity-70 text-sm">No releases added yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {releases.map((r) => (
              <Link
                key={String(r.id)}
                href={`/release/${r.slug}`}
                className="group block rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.cover_url || '/placeholder/cover1.jpg'}
                  alt={r.title}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2">
                  <div className="font-semibold leading-tight group-hover:underline truncate">{r.title}</div>
                  <div className="text-xs opacity-70">{r.year ?? '—'}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {r.rating_staff != null && (
                      <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                        <span role="img" aria-label="mic">🎙️</span>
                        <strong className="tabular-nums">{r.rating_staff}</strong>
                      </span>
                    )}
                    {r.people_avg != null && (
                      <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                        <span role="img" aria-label="fire">🔥</span>
                        <strong className="tabular-nums">{r.people_avg}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .input { background:#0a0a0a; border:1px solid #27272a; border-radius:0.5rem; padding:0.5rem 0.75rem; color:#f4f4f5; outline:none; }
        .input::placeholder { color:#a1a1aa; }
        .input:focus { box-shadow:0 0 0 2px rgba(249,115,22,0.35); }
        .btn { background:#f97316; color:#000; font-weight:700; border-radius:0.5rem; padding:0.55rem 0.9rem; }
      `}</style>
    </main>
  );
}

function Chip({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1">
      <span className="opacity-70">{label}</span>
      <strong className="tabular-nums">{value}</strong>
    </span>
  );
}
