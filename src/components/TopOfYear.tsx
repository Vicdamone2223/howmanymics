'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Release = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
  release_ratings?: { rating: number }[];
};

export default function TopOfYear({ year = 2025 }: { year?: number }) {
  const [rows, setRows] = useState<(Release & { people_avg: number | null; _score: number })[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('releases')
        .select('id,title,slug,cover_url,year,rating_staff,release_ratings(rating)')
        .eq('year', year)
        .limit(1000);
      const scored = (data || []).map((r: any) => {
        const nums = (r.release_ratings || []).map((x: any) => Number(x.rating)).filter(Number.isFinite);
        const people_avg = nums.length ? Math.round(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : null;
        const staff = r.rating_staff ?? null;
        const _score = (Number(staff ?? 0) + Number(people_avg ?? 0)) / 2; // 50/50
        return { ...r, people_avg, _score };
      });
      scored.sort((a, b) => b._score - a._score);
      setRows(scored.slice(0, 4));
    })();
  }, [year]);

  if (!rows.length) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Top Albums of {year}</h2>
        <Link className="text-sm opacity-80 hover:opacity-100 underline" href={`/albums?year=${year}`}>
          View all {year}
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rows.map((r) => (
          <Link
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
              <div className="font-semibold leading-tight group-hover:underline truncate">{r.title}</div>
              <div className="text-xs opacity-70">{r.year ?? '—'}</div>

              <div className="mt-2 flex items-center gap-2 text-xs">
                {r.rating_staff != null && (
                  <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                    <span role="img" aria-label="mic">🎙️</span>
                    <strong className="tabular-nums">{r.rating_staff}</strong>
                  </span>
                )}
                {r.people_avg != null && (
                  <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                    <span role="img" aria-label="fire">🔥</span>
                    <strong className="tabular-nums">{r.people_avg}</strong>
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
