// src/app/release/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import YouTubeEmbed from '@/components/YouTubeEmbed';
import AlbumComments from '@/components/AlbumComments';

type ReleaseRow = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  producers: string[] | null;
  labels: string[] | null;
  youtube_id: string | null;     // can be full url or bare id
  riaa_cert: string | null;
  rating_staff: number | null;
  tracks_disc1: string[] | null; // legacy fallback
  tracks_disc2: string[] | null; // legacy fallback
};

type TrackRow = {
  disc_no: number;
  track_no: number;
  title: string;
  duration_seconds: number | null;
  features: { id: number | string; name: string; slug: string }[];
};

type RatingRow = { rating: number };

type ReviewArticle = {
  id: number;
  slug: string;
  title: string;
  dek: string | null;
  author: string | null;
  published_at: string | null;
};

export default function ReleasePage() {
  const { slug } = useParams<{ slug: string }>();

  const [rel, setRel] = useState<ReleaseRow | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [peopleAvg, setPeopleAvg] = useState<number | null>(null);
  const [review, setReview] = useState<ReviewArticle | null>(null);

  // rating UI
  const [inputRating, setInputRating] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: sess } = await supabase.auth.getSession();
      setSessionEmail(sess.session?.user?.email ?? null);

      // 1) Load release
      const { data: rData, error: rErr } = await supabase
        .from('releases')
        .select(
          'id,title,slug,cover_url,year,producers,labels,youtube_id,riaa_cert,rating_staff,tracks_disc1,tracks_disc2'
        )
        .eq('slug', slug)
        .single();

      if (rErr || !rData) {
        console.error('release fetch error:', rErr);
        setRel(null);
        setLoading(false);
        return;
      }
      const release = rData as ReleaseRow;
      setRel(release);

      // 2) Tracks (primary: view; fallback: legacy arrays)
      let gotTracks: TrackRow[] = [];
      try {
        const { data: vData, error: vErr } = await supabase
          .from('v_tracks_with_features')
          .select('disc_no,track_no,title,duration_seconds,features,release_id')
          .eq('release_id', release.id)
          .order('disc_no', { ascending: true })
          .order('track_no', { ascending: true });

        if (!vErr && (vData?.length ?? 0) > 0) {
          gotTracks = (vData as any).map((t: any) => ({
            disc_no: Number(t.disc_no || 1),
            track_no: Number(t.track_no || 0),
            title: t.title,
            duration_seconds: typeof t.duration_seconds === 'number' ? t.duration_seconds : null,
            features: Array.isArray(t.features) ? t.features : [],
          }));
        }
      } catch {
        // ignore; will fall back to legacy arrays
      }

      // Fallback: legacy arrays on releases
      if (gotTracks.length === 0) {
        const d1 = (release.tracks_disc1 || []).map((title, i) => ({
          disc_no: 1,
          track_no: i + 1,
          title,
          duration_seconds: null,
          features: [] as TrackRow['features'],
        }));
        const d2 = (release.tracks_disc2 || []).map((title, i) => ({
          disc_no: 2,
          track_no: i + 1,
          title,
          duration_seconds: null,
          features: [] as TrackRow['features'],
        }));
        gotTracks = [...d1, ...d2];
      }
      setTracks(gotTracks);

      // 3) People avg
      const { data: pr } = await supabase
        .from('release_ratings')
        .select('rating')
        .eq('release_id', release.id)
        .limit(5000);
      const nums = (pr || []).map((x: RatingRow) => Number(x.rating)).filter(Number.isFinite);
      setPeopleAvg(nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null);

      // 4) Staff review (best-effort: match by title)
      try {
        const { data: rev } = await supabase
          .from('articles')
          .select('id,slug,title,dek,author,published_at,kind')
          .eq('kind', 'review')
          .ilike('title', `%${release.title}%`)
          .order('published_at', { ascending: false })
          .limit(1);

        const row = (rev || [])[0] as any;
        if (row) {
          setReview({
            id: row.id,
            slug: row.slug,
            title: row.title,
            dek: row.dek,
            author: row.author,
            published_at: row.published_at,
          });
        } else {
          setReview(null);
        }
      } catch {
        setReview(null);
      }

      setLoading(false);
    })();
  }, [slug]);

  const overallScore = useMemo(() => {
    const staff = rel?.rating_staff ?? null;
    const ppl = peopleAvg ?? null;
    if (staff == null && ppl == null) return null;
    if (staff != null && ppl == null) return Math.round(staff);
    if (staff == null && ppl != null) return Math.round(ppl);
    return Math.round(0.5 * Number(staff) + 0.5 * Number(ppl));
  }, [rel?.rating_staff, peopleAvg]);

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!rel) return;
    const parsed = parseInt(inputRating, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(50, Math.min(100, parsed)) : NaN;
    if (Number.isNaN(clamped)) return alert('Please enter a number from 50 to 100.');

    setSaving(true);
    try {
      const { error } = await supabase.from('release_ratings').insert({
        release_id: rel.id,
        rating: clamped,
      });
      if (error) throw error;

      // refresh avg
      const { data: pr } = await supabase
        .from('release_ratings')
        .select('rating')
        .eq('release_id', rel.id)
        .limit(5000);
      const nums = (pr || []).map((x: RatingRow) => Number(x.rating)).filter(Number.isFinite);
      setPeopleAvg(nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null);
      setInputRating('');
      alert('Thanks for rating!');
    } catch (err: any) {
      alert(err?.message || 'Could not save rating.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  if (!rel) notFound();

  const byDisc = groupByDisc(tracks);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rel.cover_url || '/placeholder/cover1.jpg'}
          alt={rel.title}
          className="h-40 w-40 rounded-xl object-cover border border-zinc-800"
        />
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">{rel.title}</h1>
          <div className="mt-1 text-sm opacity-75">{rel.year ?? '—'}</div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {rel.producers?.length ? (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span className="opacity-70">Producers</span>
                <strong>{rel.producers.join(', ')}</strong>
              </span>
            ) : null}
            {rel.labels?.length ? (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span className="opacity-70">Labels</span>
                <strong>{rel.labels.join(', ')}</strong>
              </span>
            ) : null}
            {rel.riaa_cert ? (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span className="opacity-70">RIAA</span>
                <strong>{rel.riaa_cert}</strong>
              </span>
            ) : null}
            {rel.rating_staff != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span role="img" aria-label="mic">🎙️</span>
                <strong className="tabular-nums">{rel.rating_staff}</strong>
              </span>
            )}
            {peopleAvg != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span role="img" aria-label="fire">🔥</span>
                <strong className="tabular-nums">{peopleAvg}</strong>
              </span>
            )}
            {overallScore != null && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                <span className="opacity-70">Overall</span>
                <strong className="tabular-nums">{overallScore}</strong>
              </span>
            )}
          </div>

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
              <button className="btn" disabled={saving} type="submit">Submit</button>
            </form>
          ) : (
            <div className="mt-3 text-xs opacity-75">
              <a href="/login" className="underline">Sign in</a> to rate this album.
            </div>
          )}
        </div>
      </div>

      {/* YouTube */}
      <section className="mt-6">
        <YouTubeEmbed input={rel.youtube_id} title={`${rel.title} — video`} />
      </section>

      {/* Tracklist */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-3">Tracklist</h2>
        {!tracks.length ? (
          <p className="opacity-70 text-sm">No tracks found.</p>
        ) : (
          Object.keys(byDisc).map((disc) => (
            <div key={disc} className="mb-4">
              <div className="text-sm opacity-70 mb-2">Disc {disc}</div>
              <ol className="space-y-1 list-decimal ml-5">
                {byDisc[disc].map((t) => (
                  <li key={`${disc}-${t.track_no}`} className="pl-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.title}</span>
                      {t.features?.length ? (
                        <span className="opacity-80 text-xs">
                          feat.{' '}
                          {t.features.map((f, idx) => (
                            <span key={String(f.id)}>
                              <Link href={`/artist/${f.slug}`} className="underline">{f.name}</Link>
                              {idx < t.features.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>

      {/* Staff review (best-effort) */}
      {review && (
        <section className="mt-8 rounded-xl border border-zinc-800 p-4">
          <div className="text-xs uppercase opacity-60 mb-1">Staff Review</div>
          <h3 className="font-semibold">
            <Link href={`/articles/${review.slug}`} className="underline">{review.title}</Link>
          </h3>
          {review.dek ? <p className="opacity-85 mt-1">{review.dek}</p> : null}
          {(review.author || review.published_at) && (
            <div className="text-xs opacity-60 mt-2">
              {review.author ? <>By {review.author}</> : null}
              {review.author && review.published_at ? ' • ' : null}
              {review.published_at ? new Date(review.published_at).toLocaleDateString() : null}
            </div>
          )}
        </section>
      )}

      {/* Comments */}
      <section className="mt-8 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Comments</h2>
        <AlbumComments releaseId={rel.id} />
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

function groupByDisc(list: TrackRow[]) {
  const map: Record<string, TrackRow[]> = {};
  for (const t of list) {
    const k = String(t.disc_no || 1);
    if (!map[k]) map[k] = [];
    map[k].push(t);
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.track_no - b.track_no);
  }
  return map;
}
