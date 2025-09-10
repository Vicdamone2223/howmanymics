// src/app/albums/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Release = {
  id: number | string;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
  release_ratings?: { rating: number }[];
};

const PAGE_SIZE = 24;

export default function AlbumsPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>}>
      <AlbumsInner />
    </Suspense>
  );
}

function AlbumsInner() {
  const router = useRouter();
  const params = useSearchParams();

  const q = (params.get('q') || '').trim();
  const yearFilter = params.get('year');
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const [rows, setRows] = useState<Release[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      let req = supabase
        .from('releases')
        .select('id,title,slug,cover_url,year,rating_staff,release_ratings(rating)')
        .order('year', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (yearFilter) req = req.eq('year', Number(yearFilter));
      if (q) req = req.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);

      const { data, error } = await req;
      if (error) {
        console.error(error);
        setRows([]);
        setHasMore(false);
      } else {
        const batch = (data || []) as Release[];
        setRows(batch);
        setHasMore(batch.length === PAGE_SIZE);
      }
      setLoading(false);
    })();
  }, [q, yearFilter, page]);

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params);
    if (value === null || value === '') sp.delete(key);
    else sp.set(key, value);
    // whenever filters change, reset to page 1
    sp.set('page', '1');
    router.replace(`/albums?${sp.toString()}`);
  }

  function go(p: number) {
    const sp = new URLSearchParams(params);
    sp.set('page', String(p));
    router.replace(`/albums?${sp.toString()}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input w-full sm:w-80"
          placeholder="Search albums by title or slug…"
          defaultValue={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <select
          className="input"
          value={yearFilter || ''}
          onChange={(e) => setParam('year', e.target.value || null)}
        >
          <option value="">All years</option>
          {Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading && rows.length === 0 ? (
        <p className="opacity-70 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="opacity-70 text-sm">No albums found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {rows.map((r) => (
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
                <div className="font-semibold leading-tight group-hover:underline truncate">{r.title}</div>
                <div className="text-xs opacity-70">{r.year ?? '—'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          className="text-sm px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          ← Prev
        </button>
        <div className="text-xs opacity-70">Page {page}</div>
        <button
          className="text-sm px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
          disabled={!hasMore}
          onClick={() => go(page + 1)}
        >
          Next →
        </button>
      </div>

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
