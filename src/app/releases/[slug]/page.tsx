// app/releases/[slug]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Release = {
  id: string | number;
  title: string;
  slug: string;
  artist_id: string | number;
  year: number | null;
  cover_url: string | null;
  producers: string[] | null;
  labels: string[] | null;
  youtube_id: string | null;
  is_double_album: boolean | null;
  tracks_disc1: string[] | null;
  tracks_disc2: string[] | null;
  riaa_cert: string | null;
};

type Artist = { id: string | number; name: string; slug: string };

function MetaLine({ label, values }: { label: string; values: string[] | null }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="mt-3 text-sm">
      <span className="opacity-70 mr-2">{label}:</span>
      <span className="opacity-90">{values.join(', ')}</span>
    </div>
  );
}

export default function ReleasePage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [rel, setRel] = useState<Release | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);

  useEffect(() => {
    (async () => {
      const { data: r, error: rErr } = await supabase
        .from('releases')
        .select(
          'id,title,slug,artist_id,year,cover_url,producers,labels,youtube_id,is_double_album,tracks_disc1,tracks_disc2,riaa_cert'
        )
        .eq('slug', slug)
        .single();

      if (rErr || !r) {
        console.error('Release fetch failed:', rErr);
        setLoading(false);
        setRel(null);
        return;
      }
      setRel(r as Release);

      const { data: a, error: aErr } = await supabase
        .from('artists')
        .select('id,name,slug')
        .eq('id', r.artist_id)
        .single();

      if (aErr) console.error('Artist fetch failed:', aErr);
      setArtist(a as Artist);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>;
  if (!rel) notFound();

  const list1 = rel.tracks_disc1 || [];
  const list2 = rel.tracks_disc2 || [];
  const hasDisc2 = !!(rel.is_double_album && list2.length);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
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

          <MetaLine label="Producers" values={rel.producers} />
          <MetaLine label="Labels" values={rel.labels} />

          {rel.riaa_cert && (
            <div className="mt-3 text-sm">
              <span className="opacity-70 mr-2">RIAA:</span>
              <span className="opacity-90">{rel.riaa_cert}</span>
            </div>
          )}
        </div>
      </div>

      {rel.youtube_id && (
        <section className="mt-8">
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${rel.youtube_id}`}
              title="YouTube player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {(list1.length > 0 || list2.length > 0) && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold mb-3">{hasDisc2 ? 'Disc 1' : 'Tracklist'}</h3>
            {list1.length === 0 ? (
              <p className="text-sm opacity-70">No tracks yet.</p>
            ) : (
              <ol className="space-y-1">
                {list1.map((t, i) => (
                  <li key={`d1-${i}`} className="text-sm flex gap-2">
                    <span className="opacity-50 tabular-nums w-6">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {hasDisc2 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Disc 2</h3>
              {list2.length === 0 ? (
                <p className="text-sm opacity-70">No tracks yet.</p>
              ) : (
                <ol className="space-y-1">
                  {list2.map((t, i) => (
                    <li key={`d2-${i}`} className="text-sm flex gap-2">
                      <span className="opacity-50 tabular-nums w-6">{i + 1}.</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
