// src/app/release/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import SimilarAlbums from '@/components/SimilarAlbums';
import AlbumReviews from '@/components/AlbumReviews';
import AlbumComments from '@/components/AlbumComments';
import YouTubeEmbed from '@/components/YouTubeEmbed';

type Artist = { id:number|string; name:string; slug:string };
type TrackRow = { id:string; track_no:number; title:string; duration_seconds:number|null };
type TrackArtist = { track_id:string; artist_id:number; role:'primary'|'feature'|'producer' };

type Release = {
  id: number | string;
  title: string;
  slug: string;
  artist_id: number | string;
  year: number | null;
  cover_url: string | null;
  producers?: string[] | null;
  labels?: string[] | null;
  youtube_id?: string | null;
  rating_staff?: number | null;

  // legacy/optional fields
  tracks?: any;
  is_double_album?: boolean | null;
  tracks_disc1?: any;
  tracks_disc2?: any;

  // RIAA legacy variants
  riaa_albums_sold?: number | null;
  riaa_certification?: string | null;
  riaa_cert?: string | null;
};

export default function ReleasePage() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [rel, setRel] = useState<Release | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<TrackRow[] | null>(null);
  const [featuresByTrack, setFeaturesByTrack] = useState<Record<string, Artist[]>>({});
  const [peopleAvg, setPeopleAvg] = useState<number | null>(null); // for fire emoji

  useEffect(() => {
    (async () => {
      // release
      const { data: r, error: rErr } = await supabase
        .from('releases')
        .select('*')
        .eq('slug', slug)
        .single();

      if (rErr || !r) {
        setLoading(false);
        setRel(null);
        return;
      }
      setRel(r as Release);

      // artist
      const { data: a } = await supabase
        .from('artists')
        .select('id,name,slug')
        .eq('id', r.artist_id)
        .single();
      if (a) setArtist(a as Artist);

      // normalized tracks
      const { data: trows } = await supabase
        .from('tracks')
        .select('id,track_no,title,duration_seconds')
        .eq('release_id', r.id)
        .order('track_no', { ascending: true });

      if (trows && trows.length) {
        setTracks(trows as TrackRow[]);
        const trackIds = trows.map((t) => t.id);

        const { data: tas } = await supabase
          .from('track_artists')
          .select('track_id,artist_id,role')
          .in('track_id', trackIds);

        const feats = (tas || []).filter((x) => x.role === 'feature') as TrackArtist[];
        if (feats.length) {
          const ids = Array.from(new Set(feats.map((f) => f.artist_id)));
          const { data: arts } = await supabase
            .from('artists')
            .select('id,name,slug')
            .in('id', ids);

          const map = new Map<number, Artist>();
          (arts || []).forEach((a2) => map.set(Number(a2.id), a2 as Artist));

          const by: Record<string, Artist[]> = {};
          for (const f of feats) {
            const a2 = map.get(Number(f.artist_id));
            if (!a2) continue;
            if (!by[f.track_id]) by[f.track_id] = [];
            by[f.track_id].push(a2);
          }
          setFeaturesByTrack(by);
        }
      } else {
        setTracks(null);
      }

      // people avg for this release (from release_ratings)
      const { data: rr } = await supabase
        .from('release_ratings')
        .select('rating')
        .eq('release_id', r.id);

      if (rr && rr.length) {
        const nums = rr.map((x: any) => Number(x.rating)).filter((n) => Number.isFinite(n));
        const avg = nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null;
        setPeopleAvg(avg);
      } else {
        setPeopleAvg(null);
      }

      setLoading(false);
    })();
  }, [slug]);

  const riaaText = useMemo(() => {
    if (!rel) return '';
    const cert = (rel.riaa_certification ?? rel.riaa_cert ?? '') as string;
    const units =
      rel.riaa_albums_sold != null ? ` (${Number(rel.riaa_albums_sold).toLocaleString()} units)` : '';
    return (cert + units).trim();
  }, [rel]);

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>;
  if (!rel) notFound();

  // Legacy fallbacks (support either tracks_disc1 or old tracks array)
  const legacyDisc1: string[] =
    Array.isArray((rel as any).tracks_disc1)
      ? (rel as any).tracks_disc1
      : Array.isArray(rel.tracks)
      ? (rel.tracks as any)
      : [];
  const legacyDisc2: string[] = Array.isArray((rel as any).tracks_disc2)
    ? (rel as any).tracks_disc2
    : [];
  const hasDisc2Legacy = !!rel.is_double_album && legacyDisc2.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Top */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rel.cover_url || '/placeholder/cover1.jpg'}
          alt={rel.title}
          className="w-56 h-56 rounded-xl object-cover border border-zinc-800"
        />
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">{rel.title}</h1>
          <div className="mt-2 text-sm opacity-80">
            {artist ? (
              <a href={`/artist/${artist.slug}`} className="hover:underline">
                {artist.name}
              </a>
            ) : (
              <span>Unknown artist</span>
            )}
            {rel.year && <span> • {rel.year}</span>}
          </div>

          <MetaLine label="Producers" values={rel.producers || null} />
          <MetaLine label="Labels" values={rel.labels || null} />

          {riaaText && (
            <div className="mt-3 text-sm">
              <span className="opacity-70 mr-2">RIAA:</span>
              <span className="opacity-90">{riaaText}</span>
            </div>
          )}

          {/* Ratings row for album: 🎙️ staff + 🔥 people */}
          {(rel.rating_staff != null || peopleAvg != null) && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              {rel.rating_staff != null && (
                <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                  <span role="img" aria-label="mic">🎙️</span>
                  <strong className="tabular-nums">{rel.rating_staff}</strong>
                </span>
              )}
              {peopleAvg != null && (
                <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                  <span role="img" aria-label="fire">🔥</span>
                  <strong className="tabular-nums">{peopleAvg}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* YouTube */}
      {rel.youtube_id && (
        <section className="mt-8">
          <YouTubeEmbed input={rel.youtube_id} title={`${rel.title} — YouTube`} />
        </section>
      )}

      {/* Tracklists */}
      <section className="mt-8">
        <h2 className="text-lg font-bold mb-3">Tracklist</h2>

        {/* Prefer normalized tracks */}
        {Array.isArray(tracks) && tracks.length > 0 ? (
          <ol className="list-decimal list-inside grid gap-2">
            {tracks.map((t) => (
              <li key={t.id} className="opacity-90">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="font-medium">{t.title}</span>
                  {featuresByTrack[t.id]?.length ? (
                    <span className="text-xs opacity-75">
                      • feat{' '}
                      {featuresByTrack[t.id].map((fa, i) => (
                        <Link key={fa.slug} className="hover:underline" href={`/artist/${fa.slug}`}>
                          {fa.name}
                          {i < featuresByTrack[t.id].length - 1 ? ', ' : ''}
                        </Link>
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <>
            {!legacyDisc1.length ? (
              <p className="opacity-70 text-sm">No tracks added yet.</p>
            ) : (
              <>
                {hasDisc2Legacy && <div className="text-sm opacity-70 mb-2">Disc One</div>}
                <ol className="list-decimal list-inside grid gap-1 mb-4">
                  {legacyDisc1.map((t, i) => (
                    <li key={`d1-${i}`} className="opacity-90">
                      {t}
                    </li>
                  ))}
                </ol>
              </>
            )}

            {hasDisc2Legacy && (
              <>
                <div className="text-sm opacity-70 mb-2 mt-4">Disc Two</div>
                <ol className="list-decimal list-inside grid gap-1">
                  {legacyDisc2.map((t, i) => (
                    <li key={`d2-${i}`} className="opacity-90">
                      {t}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        )}
      </section>

      {/* Similar + Reviews + Comments */}
      <section className="mt-10">
        <h3 className="text-lg font-bold mb-3">You might also like</h3>
        <SimilarAlbums releaseId={rel.id} />
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-bold mb-3">Staff Review</h3>
        <AlbumReviews releaseId={rel.id} />
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-bold mb-3">Comments</h3>
        <AlbumComments releaseId={rel.id} />
      </section>
    </main>
  );
}

function MetaLine({ label, values }: { label: string; values: string[] | null }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="mt-3 text-sm">
      <span className="opacity-70 mr-2">{label}:</span>
      <span className="opacity-90">{values.join(', ')}</span>
    </div>
  );
}
