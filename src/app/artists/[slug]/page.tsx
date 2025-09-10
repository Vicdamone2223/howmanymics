// src/app/artist/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Artist = {
  id: string;
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
  rating_staff: number | null;    // optional staff score 50–100
};

type ReleaseRow = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
};

type MemberRating = { artist_id: string; score: number };

export default function ArtistPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);

  // auth + ratings
  const [userId, setUserId] = useState<string | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [peopleAvg, setPeopleAvg] = useState<number | null>(null);
  const [peopleCount, setPeopleCount] = useState<number>(0);
  const [pendingScore, setPendingScore] = useState<number>(90);

  useEffect(() => {
    // session
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user?.id ?? null);
    })();
  }, []);

  // fetch artist + releases + ratings
  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) artist
      const { data: a, error: aErr } = await supabase
        .from('artists')
        .select('*')
        .eq('slug', slug)
        .single();

      if (aErr || !a) { setLoading(false); setArtist(null); return; }
      const artistObj = a as Artist;
      setArtist(artistObj);

      // 2) discography
      const { data: rels } = await supabase
        .from('releases')
        .select('id,title,slug,cover_url,year')
        .eq('artist_id', artistObj.id)
        .order('year', { ascending: true });
      setReleases(rels || []);

      // 3) all ratings for this artist (for average)
      const { data: ratings } = await supabase
        .from('artist_ratings')
        .select('artist_id,score')
        .eq('artist_id', artistObj.id);
      const list = (ratings || []) as MemberRating[];
      if (list.length) {
        const sum = list.reduce((s, r) => s + r.score, 0);
        setPeopleAvg(sum / list.length);
        setPeopleCount(list.length);
      } else {
        setPeopleAvg(null);
        setPeopleCount(0);
      }

      // 4) my rating if logged in
      if (userId) {
        const { data: mine } = await supabase
          .from('artist_ratings')
          .select('score')
          .eq('artist_id', artistObj.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (mine?.score != null) setMyScore(mine.score as number);
      } else {
        setMyScore(null);
      }

      setLoading(false);
    })();
  }, [slug, userId]);

  const overall = useMemo(() => {
    if (!artist) return null;
    const s = typeof artist.rating_staff === 'number' ? artist.rating_staff : null;
    const p = peopleAvg;
    if (s != null && p != null) return 0.6 * s + 0.4 * p;   // 60/40 weighting
    if (s != null) return s;
    if (p != null) return p;
    return null;
  }, [artist, peopleAvg]);

  async function submitRating() {
    if (!artist || !userId) return;
    const score = Math.max(50, Math.min(100, Math.round(pendingScore)));

    // Try insert; unique constraint prevents duplicates
    const { error } = await supabase
      .from('artist_ratings')
      .insert({ artist_id: artist.id, user_id: userId, score });

    if (error) {
      // 23505 = unique_violation (already rated)
      if ((error as any).code !== '23505') {
        alert(error.message || 'Could not submit rating.');
        return;
      }
    }

    // Lock in UI and recompute average
    setMyScore(score);
    const { data: ratings } = await supabase
      .from('artist_ratings')
      .select('artist_id,score')
      .eq('artist_id', artist.id);
    const list = (ratings || []) as MemberRating[];
    const sum = list.reduce((s, r) => s + r.score, 0);
    setPeopleAvg(sum / list.length);
    setPeopleCount(list.length);
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>;
  }
  if (!artist) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
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
                Staff Rank #{artist!.staff_rank}
              </span>
            )}
          </div>
          <div className="mt-2 text-sm opacity-80">
            {artist!.origin && <span>{artist!.origin}</span>}
            {artist!.origin && artist!.years_active && <span> • </span>}
            {artist!.years_active && <span>{artist!.years_active}</span>}
          </div>
          {artist!.bio && <p className="mt-3 opacity-90 max-w-2xl">{artist!.bio}</p>}

          {/* Achievements */}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Chip label="Hot 100 entries" value={artist!.billboard_hot100_entries} />
            <Chip label="Platinum awards" value={artist!.platinum} />
            <Chip label="Grammys" value={artist!.grammys} />
          </div>
        </div>

        {/* Ratings summary + member action */}
        <div className="w-full sm:w-72 rounded-xl border border-zinc-800 p-3 bg-zinc-900/30">
          <div className="text-sm opacity-70 mb-2">Ratings</div>
          <div className="grid grid-cols-3 gap-2 items-center text-center">
            <div className="rounded-lg border border-zinc-800 p-2">
              <div className="text-[10px] uppercase opacity-70">Staff</div>
              <div className="text-xl font-bold tabular-nums">
                {artist!.rating_staff != null ? Math.round(artist!.rating_staff) : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 p-2">
              <div className="text-[10px] uppercase opacity-70">People</div>
              <div className="text-xl font-bold tabular-nums">
                {peopleAvg != null ? Math.round(peopleAvg) : '—'}
              </div>
              <div className="text-[10px] opacity-60">{peopleCount} vote{peopleCount === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-lg border border-orange-500/40 p-2 bg-orange-500/5">
              <div className="text-[10px] uppercase opacity-80">Overall</div>
              <div className="text-xl font-extrabold tabular-nums">
                {overall != null ? Math.round(overall) : '—'}
              </div>
              <div className="text-[10px] opacity-70">60/40 weighted</div>
            </div>
          </div>

          <div className="mt-3 border-t border-zinc-800 pt-3">
            {!userId ? (
              <a href="/login" className="text-sm underline opacity-90">Sign in to rate</a>
            ) : myScore != null ? (
              <div className="text-sm">
                You rated this artist: <b className="tabular-nums">{myScore}</b>
                <div className="text-xs opacity-70">One rating per member.</div>
              </div>
            ) : (
              <form
                onSubmit={e => { e.preventDefault(); submitRating(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="number"
                  min={50}
                  max={100}
                  step={1}
                  value={pendingScore}
                  onChange={e => setPendingScore(parseInt(e.target.value || '50', 10))}
                  className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-500 tabular-nums"
                />
                <button className="text-sm px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-900" type="submit">
                  Rate
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Discography */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-3">Discography</h2>
        {releases.length === 0 ? (
          <p className="opacity-70 text-sm">No releases added yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {releases.map(r => (
              <a
                key={r.id}
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
                  <div className="font-semibold leading-tight group-hover:underline">{r.title}</div>
                  <div className="text-xs opacity-70">{r.year ?? '—'}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
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
