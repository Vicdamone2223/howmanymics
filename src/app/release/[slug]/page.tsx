// src/app/release/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type ReleaseRow = {
  id: number | string;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
  artist_id: number | string | null;      // legacy primary artist
  tracks_disc1: string[] | null;
  tracks_disc2: string[] | null;
  is_double_album: boolean | null;
  producers: string[] | null;
  labels: string[] | null;
  youtube_id: string | null;
  release_ratings?: { rating: number }[] | null;
};

type ArtistLite = { id: number | string; name: string; slug: string } | null;

type MyRating = { id: string | number; rating: number } | null;

export default function ReleasePage() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ReleaseRow | null>(null);
  const [artist, setArtist] = useState<ArtistLite>(null);

  // ratings state
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [peopleAvg, setPeopleAvg] = useState<number | null>(null);
  const [myRating, setMyRating] = useState<MyRating>(null);
  const [inputRating, setInputRating] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // bootstrap
  useEffect(() => {
    (async () => {
      setLoading(true);

      // session (for user rating)
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      setSessionUserId(uid);

      // fetch release WITH tracklists
      const sel =
        'id,title,slug,cover_url,year,rating_staff,artist_id,tracks_disc1,tracks_disc2,is_double_album,producers,labels,youtube_id,release_ratings(rating)';
      const { data, error } = await supabase
        .from('releases')
        .select(sel)
        .eq('slug', slug)
        .single();

      if (error || !data) {
        setLoading(false);
        setRow(null);
        return;
      }

      const r = data as ReleaseRow;
      setRow(r);

      // compute people avg from all ratings
      const ratings = Array.isArray(r.release_ratings) ? r.release_ratings : [];
      const nums = ratings
        .map((x) => Number(x.rating))
        .filter((v): v is number => Number.isFinite(v));
      const avg = nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
      setPeopleAvg(avg);

      // fetch legacy primary artist if present
      if (r.artist_id != null) {
        const { data: a } = await supabase
          .from('artists')
          .select('id,name,slug')
          .eq('id', r.artist_id)
          .maybeSingle();
        if (a) setArtist(a as ArtistLite);
      } else {
        setArtist(null);
      }

      // my rating (if logged in)
      if (uid && r.id) {
        const { data: mine } = await supabase
          .from('release_ratings')
          .select('id,rating')
          .eq('release_id', r.id)
          .eq('user_id', uid)
          .limit(1);
        if (mine?.length) {
          setMyRating({ id: mine[0].id, rating: mine[0].rating });
          setInputRating(String(mine[0].rating));
        } else {
          setMyRating(null);
          setInputRating('');
        }
      } else {
        setMyRating(null);
        setInputRating('');
      }

      setLoading(false);
    })();
  }, [slug]);

  const overallScore = useMemo(() => {
    const staff = row?.rating_staff ?? null;
    const ppl = peopleAvg ?? null;
    if (staff == null && ppl == null) return null;
    if (staff != null && ppl == null) return Math.round(staff);
    if (staff == null && ppl != null) return Math.round(ppl);
    return Math.round(0.5 * Number(staff) + 0.5 * Number(ppl));
  }, [row?.rating_staff, peopleAvg]);

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!row || !row.id) return;
    if (!sessionUserId) {
      alert('Please sign in to rate.');
      return;
    }

    const parsed = parseInt(inputRating, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(50, Math.min(100, parsed)) : NaN;
    if (Number.isNaN(clamped)) return alert('Please enter a number from 50 to 100.');

    setSaving(true);
    try {
      if (myRating) {
        const { error } = await supabase
          .from('release_ratings')
          .update({ rating: clamped })
          .eq('id', myRating.id);
        if (error) throw error;
        setMyRating({ id: myRating.id, rating: clamped });
      } else {
        const { data, error } = await supabase
          .from('release_ratings')
          .insert({ release_id: row.id, user_id: sessionUserId, rating: clamped })
          .select('id,rating')
          .single();
        if (error) throw error;
        setMyRating({ id: data.id, rating: data.rating });
      }

      // recompute avg
      const { data: all } = await supabase
        .from('release_ratings')
        .select('rating')
        .eq('release_id', row.id);
      const nums = (all || [])
        .map((x: any) => Number(x.rating))
        .filter((v: any) => Number.isFinite(v));
      const avg = nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null;
      setPeopleAvg(avg);

      alert('Saved your rating.');
    } catch (err: any) {
      alert(err?.message || 'Could not save rating.');
    } finally {
      setSaving(false);
    }
  }

  async function removeMyRating() {
    if (!row || !myRating) return;
    if (!confirm('Remove your rating?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('release_ratings').delete().eq('id', myRating.id);
      if (error) throw error;
      setMyRating(null);
      setInputRating('');

      const { data: all } = await supabase
        .from('release_ratings')
        .select('rating')
        .eq('release_id', row.id);
      const nums = (all || [])
        .map((x: any) => Number(x.rating))
        .filter((v: any) => Number.isFinite(v));
      const avg = nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null;
      setPeopleAvg(avg);
    } catch (err: any) {
      alert(err?.message || 'Could not remove rating.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  if (!row) notFound();

  const d1 = Array.isArray(row.tracks_disc1) ? row.tracks_disc1 : [];
  const d2 = Array.isArray(row.tracks_disc2) ? row.tracks_disc2 : [];
  const isDouble = !!row.is_double_album && d2.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.cover_url || '/placeholder/cover1.jpg'}
          alt={row.title}
          className="h-48 w-48 rounded-xl object-cover border border-zinc-800"
        />
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold leading-tight">{row.title}</h1>
          <div className="mt-1 text-sm opacity-80">
            {artist ? (
              <Link className="underline" href={`/artist/${artist.slug}`}>{artist.name}</Link>
            ) : (
              <span>Various Artists</span>
            )}
            {row.year ? <> • {row.year}</> : null}
          </div>

          {/* Scores */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {row.rating_staff != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                <span role="img" aria-label="mic">🎙️</span>
                <strong className="tabular-nums">{row.rating_staff}</strong>
              </span>
            )}
            {peopleAvg != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                <span role="img" aria-label="fire">🔥</span>
                <strong className="tabular-nums">{peopleAvg}</strong>
              </span>
            )}
            {overallScore != null && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1 ml-1">
                <span className="opacity-70">Overall</span>
                <strong className="tabular-nums">{overallScore}</strong>
              </span>
            )}
          </div>

          {/* Rate form */}
          <div className="mt-4">
            {sessionUserId ? (
              <form onSubmit={submitRating} className="flex items-center gap-2">
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
              <div className="text-xs opacity-75">
                <a href="/login" className="underline">Sign in</a> to rate this album.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tracklists */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Tracklist title={isDouble ? 'Disc 1' : 'Tracklist'} tracks={d1} />
        {isDouble && <Tracklist title="Disc 2" tracks={d2} />}
      </section>

      {/* Meta */}
      <section className="mt-8 grid gap-2 text-sm opacity-80">
        {row.producers?.length ? (
          <div><span className="opacity-70">Producers: </span>{row.producers.join(', ')}</div>
        ) : null}
        {row.labels?.length ? (
          <div><span className="opacity-70">Labels: </span>{row.labels.join(', ')}</div>
        ) : null}
        {row.youtube_id ? (
          <div className="mt-2">
            <YouTube id={row.youtube_id} />
          </div>
        ) : null}
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
          border-radius: 0.5rem; padding: 0.55rem 0.9rem;
        }
      `}</style>
    </main>
  );
}

function Tracklist({ title, tracks }: { title: string; tracks: string[] }) {
  if (!tracks.length) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <div className="opacity-70 text-sm">No tracks listed.</div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <ol className="space-y-1">
        {tracks.map((t, i) => (
          <li key={`${title}-${i}`} className="flex gap-2">
            <span className="w-6 text-xs opacity-70 tabular-nums">{i + 1}.</span>
            <span className="text-sm">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function YouTube({ id }: { id: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800">
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${id}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
