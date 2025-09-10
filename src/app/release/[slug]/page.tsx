// src/app/release/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ReleaseRow = {
  id: number | string;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
  is_double_album: boolean | null;
  tracks_disc1: string[] | null;
  tracks_disc2: string[] | null;
  release_ratings?: { rating: number }[];
};

type MyRating = { id: string; rating: number };

export default function ReleasePage() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ReleaseRow | null>(null);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<MyRating | null>(null);
  const [inputRating, setInputRating] = useState<string>('');
  const [peopleAvg, setPeopleAvg] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // session
      const { data: sess } = await supabase.auth.getSession();
      const email = sess.session?.user?.email ?? null;
      setSessionEmail(email);

      // release
      const { data, error } = await supabase
        .from('releases')
        .select(
          'id,title,slug,cover_url,year,rating_staff,is_double_album,tracks_disc1,tracks_disc2,release_ratings(rating)'
        )
        .eq('slug', slug)
        .single();

      if (error || !data) {
        setLoading(false);
        setRow(null);
        return;
      }

      const rel = data as ReleaseRow;
      setRow(rel);

      // compute public People average from joined ratings
      const ratings = Array.isArray(rel.release_ratings) ? rel.release_ratings : [];
      const nums = ratings.map((x) => Number(x.rating)).filter((n) => Number.isFinite(n));
      setPeopleAvg(nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null);

      // load MY rating (RLS should scope to current user)
      if (email) {
        const { data: mine } = await supabase
          .from('release_ratings')
          .select('id,rating')
          .eq('release_id', rel.id)
          .limit(1);

        if (mine?.length) {
          setMyRating({ id: mine[0].id as unknown as string, rating: mine[0].rating as number });
          setInputRating(String(mine[0].rating));
        } else {
          setMyRating(null);
          setInputRating('');
        }
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

  async function refreshPeopleAvg(releaseId: number | string) {
    // re-fetch just the ratings to recompute avg (public read)
    const { data } = await supabase
      .from('release_ratings')
      .select('rating')
      .eq('release_id', releaseId);
    const nums = (data || []).map((r: any) => Number(r.rating)).filter(Number.isFinite);
    setPeopleAvg(nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null);
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
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
          .insert({ release_id: row.id, rating: clamped })
          .select('id,rating')
          .single();
        if (error) throw error;
        setMyRating({ id: data.id, rating: data.rating });
      }
      await refreshPeopleAvg(row.id);
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
      await refreshPeopleAvg(row.id);
    } catch (err: any) {
      alert(err?.message || 'Could not remove rating.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>;
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.cover_url || '/placeholder/cover1.jpg'}
          alt={row.title}
          className="h-44 w-44 rounded-xl object-cover border border-zinc-800"
        />
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">{row.title}</h1>
          <div className="mt-1 text-sm opacity-80">{row.year ?? '—'}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {row.rating_staff != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span role="img" aria-label="mic">🎙️</span>
                Staff <strong className="tabular-nums">{row.rating_staff}</strong>
              </span>
            )}
            {peopleAvg != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span role="img" aria-label="fire">🔥</span>
                People <strong className="tabular-nums">{peopleAvg}</strong>
              </span>
            )}
            {overallScore != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                Overall <strong className="tabular-nums">{overallScore}</strong>
              </span>
            )}
          </div>

          {/* Rate box */}
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
              <Link href="/login" className="underline">Sign in</Link> to rate this album.
            </div>
          )}
        </div>
      </div>

      {/* Tracklists */}
      {(row.tracks_disc1?.length || row.tracks_disc2?.length) && (
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {row.tracks_disc1?.length ? (
            <div>
              <h3 className="text-sm font-semibold mb-2">Disc 1</h3>
              <ol className="space-y-1">
                {row.tracks_disc1.map((t, i) => (
                  <li key={`d1-${i}`} className="flex items-start gap-2">
                    <span className="w-6 text-xs opacity-70 tabular-nums">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {row.is_double_album && row.tracks_disc2?.length ? (
            <div>
              <h3 className="text-sm font-semibold mb-2">Disc 2</h3>
              <ol className="space-y-1">
                {row.tracks_disc2.map((t, i) => (
                  <li key={`d2-${i}`} className="flex items-start gap-2">
                    <span className="w-6 text-xs opacity-70 tabular-nums">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      )}

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
