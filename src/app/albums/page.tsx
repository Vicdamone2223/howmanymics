'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ReleaseRow = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
  release_ratings?: { rating: number }[];
};

const PAGE = 24;

export default function AlbumsPage() {
  const sp = useSearchParams();
  const year = parseInt(sp.get('year') || String(new Date().getFullYear()), 10);

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));

  const [rows, setRows] = useState<(ReleaseRow & { people_avg: number | null; _score: number })[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = (page - 1) * PAGE;
      const to = from + PAGE - 1;

      const { data } = await supabase
        .from('releases')
        .select('id,title,slug,cover_url,year,rating_staff,release_ratings(rating)')
        .eq('year', year)
        .range(from, to)
        .order('title', { ascending: true });

      const list = (data || []) as ReleaseRow[];
      const scored = list.map((r) => {
        const pplNums = (r.release_ratings || []).map((x) => Number(x.rating)).filter(Number.isFinite);
        const people_avg = pplNums.length ? Math.round(pplNums.reduce((s, n) => s + n, 0) / pplNums.length) : null;
        const staff = r.rating_staff ?? null;
        const _score = (Number(staff ?? 0) + Number(people_avg ?? 0)) / 2;
        return { ...r, people_avg, _score };
      });

      scored.sort((a, b) => b._score - a._score);
      setRows(scored);
      setHasMore(list.length === PAGE);
      setLoading(false);
    })();
  }, [year, page]);

  const title = useMemo(() => `Albums in ${year}`, [year]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-4">{title}</h1>

      {loading && rows.length === 0 ? (
        <p className="opacity-70 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="opacity-70 text-sm">No albums found for {year}.</p>
      ) : (
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
      )}

      {/* If you want pagination later, we’ll hook up router.replace with ?page= */}
    </main>
  );
}
