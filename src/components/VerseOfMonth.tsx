// src/components/VerseOfMonth.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: number;
  month: string | null;
  artist_name: string | null;
  song_title: string | null;
  ig_url?: string | null;        // one of these will exist
  instagram_url?: string | null; // (depends on your table)
  created_at: string | null;
};

function toInstagramPermalink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const kind = parts[0]; // reel | p | tv
      const id = parts[1];
      return `https://www.instagram.com/${kind}/${id}/`;
    }
    // fallback – just ensure trailing slash
    return `https://www.instagram.com${u.pathname.replace(/\/?$/, '/')}`;
  } catch {
    return null;
  }
}

export default function VerseOfMonth() {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // try both column shapes, no errors thrown to console
      const trySelect = async (cols: string) =>
        supabase.from('verse_of_month').select(cols).order('created_at', { ascending: false }).limit(1);

      let data: Row[] | null = null;

      // 1) ig_url
      let q = await trySelect('id,month,artist_name,song_title,ig_url,created_at');
      if (!q.error && q.data?.length) data = q.data as any;

      // 2) instagram_url
      if (!data) {
        q = await trySelect('id,month,artist_name,song_title,instagram_url,created_at');
        if (!q.error && q.data?.length) data = q.data as any;
      }

      setRow(data?.[0] ?? null);
      setLoading(false);

      // ask IG to (re)process once data arrives
      setTimeout(() => {
        try {
          (window as any)?.instgrm?.Embeds?.process?.();
        } catch {}
      }, 0);
    })();
  }, []);

  const permalink = useMemo(() => {
    const url = row?.ig_url ?? row?.instagram_url ?? null;
    return toInstagramPermalink(url);
  }, [row?.ig_url, row?.instagram_url]);

  // reprocess when permalink changes
  useEffect(() => {
    try {
      (window as any)?.instgrm?.Embeds?.process?.();
    } catch {}
  }, [permalink]);

  if (loading || !row) return null;

  const mm = row.month || new Date().toISOString().slice(0, 7);
  const artist = row.artist_name || 'Unknown Artist';
  const song = row.song_title || '';

  return (
    <section className="mt-8 rounded-xl border border-zinc-800">
      <div className="px-3 py-2 text-xs uppercase tracking-wide opacity-70 border-b border-zinc-800">
        Verse of the Month — {mm}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* left copy */}
        <div className="px-4 py-3">
          <h3 className="text-lg font-bold mb-1">
            <span className="hover:underline">{artist}</span>
            {song ? <span className="opacity-70"> — {song}</span> : null}
          </h3>
          <p className="opacity-80 text-sm">Hand-picked verse highlight from this month.</p>

          {permalink && (
            <a href={permalink} target="_blank" rel="noreferrer" className="inline-block mt-4 btn">
              Watch on Instagram →
            </a>
          )}
        </div>

        {/* right embed */}
        <div className="p-2 md:border-l md:border-zinc-800">
          {permalink ? (
            <blockquote
              key={permalink} // forces IG to re-render when link changes
              className="instagram-media"
              data-instgrm-permalink={permalink}
              data-instgrm-version="14"
              style={{
                background: '#000',
                border: 0,
                margin: 0,
                maxWidth: '100%',
                width: '100%',
                minHeight: '200px',
              }}
            />
          ) : (
            <div className="h-64 grid place-items-center text-sm opacity-70">Invalid Instagram link.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .btn {
          background: #f97316;
          color: #000;
          font-weight: 700;
          border-radius: 0.5rem;
          padding: 0.55rem 0.9rem;
        }
      `}</style>
    </section>
  );
}
