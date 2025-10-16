// src/components/GoatTicker.tsx
'use client';

import { useEffect, useState, MouseEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

type RankedRow = {
  id: number | string;
  name: string;
  slug: string;
  card_img_url: string | null;
  rating_staff: number | null;
  people_avg: number | null;
  official: number | null; // same field used on Rankings page
  votes: number;
};

type Props = {
  /** How many artists to show in the ticker (default 15) */
  limit?: number;
};

export default function GoatTicker({ limit = 15 }: Props) {
  const [rows, setRows] = useState<RankedRow[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Pull from the same source of truth as /rankings
      const { data, error } = await supabase.rpc('rank_artists', {
        p_offset: 0,
        p_limit: limit,
      });

      if (!alive) return;
      if (error || !data) {
        console.error('GoatTicker rank_artists error:', error);
        setRows([]);
        return;
      }

      // Ensure we only render items that actually have an 'official' score,
      // and keep the order the RPC already provides (desc by official).
      const list = (data as RankedRow[]).filter(r => r.official != null);
      setRows(list.slice(0, limit));
    })();

    return () => {
      alive = false;
    };
  }, [limit]);

  if (rows.length === 0) return null;

  // duplicate for seamless loop
  const loop = [...rows, ...rows];

  function handleContainerClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('a')) return;
    window.location.href = '/rankings';
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-zinc-800 mb-4 cursor-pointer"
      onClick={handleContainerClick}
    >
      <div className="px-3 py-2 text-xs uppercase tracking-wide opacity-70 border-b border-zinc-800">
        GOAT Rankings
      </div>
      <div className="relative">
        <div className="flex gap-5 animate-ticker py-2 pl-3">
          {loop.map((r, i) => {
            const rank = (i % rows.length) + 1;
            return (
              <a
                key={`${r.id}-${i}`}
                href={`/artist/${r.slug}`}
                className="flex items-center gap-2 shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.card_img_url || '/placeholder/nas-card.jpg'}
                  alt={r.name}
                  className="h-7 w-7 rounded-md object-cover border border-zinc-800"
                />
                <span className="text-xs opacity-85 tabular-nums">#{rank}</span>
                <span className="text-sm font-medium">{r.name}</span>
              </a>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        /* slightly faster for ~15 artists */
        .animate-ticker {
          animation: ticker 45s linear infinite;
        }
      `}</style>
    </section>
  );
}
