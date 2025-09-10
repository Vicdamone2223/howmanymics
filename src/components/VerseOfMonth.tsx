// src/components/VerseOfMonth.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { supabase } from '@/lib/supabaseClient';

type VerseRowBase = {
  id: number;
  month: string | null;       // 'YYYY-MM'
  artist_name: string | null;
  song_title: string | null;
  is_active?: boolean | null; // may not exist
  created_at: string | null;
};

// We'll read either ig_url OR instagram_url (whichever your table has)
type VerseRow = VerseRowBase & {
  ig_url?: string | null;
  instagram_url?: string | null;
};

declare global {
  interface Window {
    instgrm?: { Embeds?: { process: () => void } };
  }
}

function toInstagramPermalink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const kind = parts[0]; // reel | p | tv
      const id   = parts[1];
      return `https://www.instagram.com/${kind}/${id}/`;
    }
    return `https://www.instagram.com${u.pathname.replace(/\/?$/, '/')}`;
  } catch {
    return null;
  }
}

export default function VerseOfMonth() {
  const [row, setRow] = useState<VerseRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      let got: VerseRow[] | null = null;

      // Try a few safe query shapes depending on which columns exist.
      // 1) ig_url + is_active
      const q1 = await supabase
        .from('verse_of_month')
        .select('id,month,artist_name,song_title,ig_url,is_active,created_at')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (!q1.error) {
        got = (q1.data ?? []) as VerseRow[];
      } else {
        // 2) ig_url only
        const q2 = await supabase
          .from('verse_of_month')
          .select('id,month,artist_name,song_title,ig_url,created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!q2.error) {
          got = (q2.data ?? []) as VerseRow[];
        } else {
          // 3) instagram_url + is_active
          const q3 = await supabase
            .from('verse_of_month')
            .select('id,month,artist_name,song_title,instagram_url,is_active,created_at')
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1);

          if (!q3.error) {
            got = (q3.data ?? []) as VerseRow[];
          } else {
            // 4) instagram_url only
            const q4 = await supabase
              .from('verse_of_month')
              .select('id,month,artist_name,song_title,instagram_url,created_at')
              .order('created_at', { ascending: false })
              .limit(1);

            if (!q4.error) {
              got = (q4.data ?? []) as VerseRow[];
            } else {
              console.error('verse_of_month fetch failed:', q4.error.message);
            }
          }
        }
      }

      setRow(got?.[0] ?? null);
      setLoading(false);
    })();
  }, []);

  const permalink = useMemo(() => {
    const url = row?.ig_url ?? row?.instagram_url ?? null;
    return toInstagramPermalink(url);
  }, [row?.ig_url, row?.instagram_url]);

  useEffect(() => {
    // (re)process Instagram markup whenever the embed url changes
    window?.instgrm?.Embeds?.process?.();
  }, [permalink]);

  if (loading) return null;
  if (!row) return null; // no configured verse → hide the section

  const mm = row.month || new Date().toISOString().slice(0, 7);
  const artist = row.artist_name || 'Unknown Artist';
  const song   = row.song_title || '';

  return (
    <section className="mt-8 rounded-xl border border-zinc-800">
      <div className="px-3 py-2 text-xs uppercase tracking-wide opacity-70 border-b border-zinc-800">
        Verse of the Month — {mm}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Left: copy */}
        <div className="px-4 py-3">
          <h3 className="text-lg font-bold mb-1">
            <span className="hover:underline">{artist}</span>
            {song ? <span className="opacity-70"> — {song}</span> : null}
          </h3>
          <p className="opacity-80 text-sm">Hand-picked verse highlight from this month.</p>

          {permalink && (
            <a
              href={permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-4 btn"
            >
              Watch on Instagram →
            </a>
          )}
        </div>

        {/* Right: Instagram embed */}
        <div className="p-2 md:border-l md:border-zinc-800">
          {permalink ? (
            <>
              <blockquote
                key={permalink}
                className="instagram-media"
                data-instgrm-permalink={permalink}
                data-instgrm-version="14"
                style={{
                  background: '#000',
                  border: 0,
                  margin: 0,
                  maxWidth: '100%',
                  width: '100%',
                }}
              />
              <Script
                id="ig-embed-js"
                src="https://www.instagram.com/embed.js"
                strategy="lazyOnload"
                onLoad={() => {
                  try { window.instgrm?.Embeds?.process?.(); } catch {}
                }}
              />
            </>
          ) : (
            <div className="h-64 grid place-items-center text-sm opacity-70">
              Invalid Instagram link.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .btn {
          background: #f97316; color: #000; font-weight: 700;
          border-radius: 0.5rem; padding: 0.55rem 0.9rem;
        }
      `}</style>
    </section>
  );
}
