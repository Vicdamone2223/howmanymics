'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ReleaseRow = {
  id: number | string;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
};

type PeopleAgg = { release_id: number; people_avg: number | null; votes: number };

export default function ReleasesPage() {
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'az'>('newest');
  const [peopleMap, setPeopleMap] = useState<Record<string, PeopleAgg>>({});

  useEffect(() => {
    (async () => {
      let query = supabase
        .from('releases')
        .select('id,title,slug,cover_url,year,rating_staff');

      if (sort === 'newest') query = query.order('year', { ascending: false }).order('id', { ascending: false });
      else query = query.order('title', { ascending: true });

      const { data } = await query.range(0, 199); // fetch first 200; adjust if needed
      const list = (data || []) as ReleaseRow[];

      // filter client-side by title
      const filtered = q.trim()
        ? list.filter(r => r.title.toLowerCase().includes(q.trim().toLowerCase()))
        : list;

      setRows(filtered);

      // people averages for shown releases
      const ids = filtered.map(r => Number(r.id));
      if (!ids.length) { setPeopleMap({}); return; }

      const { data: agg } = await supabase
        .from('release_ratings')
        .select('release_id,rating');

      const map: Record<string, PeopleAgg> = {};
      (agg || []).forEach((r: any) => {
        const id = String(r.release_id);
        if (!map[id]) map[id] = { release_id: r.release_id, people_avg: 0, votes: 0 };
        map[id].people_avg = ((map[id].people_avg || 0) * map[id].votes + r.rating) / (map[id].votes + 1);
        map[id].votes += 1;
      });
      // round
      Object.values(map).forEach(m => {
        if (m.votes > 0 && m.people_avg != null) m.people_avg = Math.round(m.people_avg);
        else m.people_avg = null;
      });

      setPeopleMap(map);
    })();
  }, [q, sort]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <input
          className="input w-full sm:w-80"
          placeholder="Filter by title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-40" value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="newest">Newest</option>
          <option value="az">A–Z</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="opacity-70 text-sm">No albums found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {rows.map(r => {
            const agg = peopleMap[String(r.id)];
            const ppl = agg?.people_avg ?? null;
            return (
              <Link
                key={String(r.id)}
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
                  <div className="text-xs opacity-70 mb-1">{r.year ?? '—'}</div>

                  {/* Ratings row */}
                  <div className="flex items-center gap-3 text-xs">
                    {/* Staff = mic */}
                    {r.rating_staff != null && (
                      <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                        <span role="img" aria-label="mic">🎤</span>
                        <strong className="tabular-nums">{r.rating_staff}</strong>
                      </span>
                    )}
                    {/* People = fire */}
                    {ppl != null && (
                      <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-1.5 py-0.5">
                        <span role="img" aria-label="fire">🔥</span>
                        <strong className="tabular-nums">{ppl}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f4f4f5;
          outline: none;
        }
        .input::placeholder { color: #a1a1aa; }
        .input:focus { box-shadow: 0 0 0 2px rgba(249,115,22,0.35); }
      `}</style>
    </main>
  );
}
