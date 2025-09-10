// src/components/GoatTicker.tsx
'use client';

import { useEffect, useState, MouseEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Artist = {
  id: string | number;
  name: string;
  slug: string;
  card_img_url: string | null;
  staff_rank: number | null;     // ordinal fallback
  rating_staff: number | null;   // 50–100 (your staff score)
};

type Rating = {
  artist_id: string | number;
  score: number;                 // 50–100 (members)
};

type Row = {
  id: string | number;
  name: string;
  slug: string;
  card_img_url: string | null;
  staff_rank: number | null;
  staffScore: number | null;
  peopleScore: number | null;
  overall: number | null;        // 60% staff + 40% people, or single-score fallback
};

export default function GoatTicker() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      // 1) pull artists
      const { data: arts } = await supabase
        .from('artists')
        .select('id,name,slug,card_img_url,staff_rank,rating_staff')
        .limit(500);

      const artists = (arts || []) as Artist[];
      if (artists.length === 0) return setRows([]);

      // 2) pull member ratings and average
      const ids = artists.map(a => a.id);
      const { data: ratings } = await supabase
        .from('artist_ratings')
        .select('artist_id,score')
        .in('artist_id', ids as any[]);

      const rlist = (ratings || []) as Rating[];
      const sum = new Map<string | number, number>();
      const cnt = new Map<string | number, number>();
      for (const r of rlist) {
        sum.set(r.artist_id, (sum.get(r.artist_id) ?? 0) + r.score);
        cnt.set(r.artist_id, (cnt.get(r.artist_id) ?? 0) + 1);
      }
      const peopleAvg = new Map<string | number, number>();
      for (const [k, s] of sum.entries()) {
        peopleAvg.set(k, s / (cnt.get(k) ?? 1));
      }

      // 3) compute overall (60/40), or fallback to whichever score exists
      const computed: Row[] = artists.map(a => {
        const staffScore = typeof a.rating_staff === 'number' ? a.rating_staff : null;
        const peopleScore = peopleAvg.has(a.id) ? Math.round(peopleAvg.get(a.id)!) : null;

        let overall: number | null = null;
        if (staffScore != null && peopleScore != null) overall = 0.6 * staffScore + 0.4 * peopleScore;
        else if (staffScore != null) overall = staffScore;
        else if (peopleScore != null) overall = peopleScore;

        return {
          id: a.id,
          name: a.name,
          slug: a.slug,
          card_img_url: a.card_img_url,
          staff_rank: a.staff_rank,
          staffScore,
          peopleScore,
          overall,
        };
      });

      // 4) Order:
      //    - First: all with a numeric overall (desc)
      //    - Then: artists with NO numeric overall but WITH staff_rank (asc)
      const withOverall = computed
        .filter(r => r.overall != null)
        .sort((a, b) => (b.overall! - a.overall!));

      const rankOnly = computed
        .filter(r => r.overall == null && r.staff_rank != null)
        .sort((a, b) => (a.staff_rank! - b.staff_rank!));

      const ordered = [...withOverall, ...rankOnly];

      setRows(ordered.slice(0, 15)); // top 15 in ticker
    })();
  }, []);

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
              <a key={`${r.id}-${i}`} href={`/artist/${r.slug}`} className="flex items-center gap-2 shrink-0">
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
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        /* slightly faster for ~15 artists */
        .animate-ticker { animation: ticker 45s linear infinite; }
      `}</style>
    </section>
  );
}
