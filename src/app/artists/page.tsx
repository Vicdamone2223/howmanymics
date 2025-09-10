// src/app/artists/page.tsx
'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Artist = {
  id: number | string;
  name: string;
  slug: string;
  card_img_url: string | null;
  rating_staff: number | null;
};

const PAGE_SIZE = 50;

export default function ArtistsPage() {
  // Wrap the client body (which calls useSearchParams) in Suspense
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>}>
      <ArtistsPageBody />
    </Suspense>
  );
}

function ArtistsPageBody() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = (searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const [rows, setRows] = useState<Artist[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let req = supabase
        .from('artists')
        .select('id,name,slug,card_img_url,rating_staff')
        .order('name', { ascending: true })
        .range((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE - 1);

      if (q) req = req.ilike('name', `%${q}%`);
      const { data } = await req;
      const batch = (data || []) as Artist[];
      setRows(batch);
      setHasMore(batch.length === PAGE_SIZE);
      setLoading(false);
    })();
  }, [q, page]);

  const onSearch = (value: string) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('q', value);
    sp.set('page', '1'); // reset
    router.replace(`/artists?${sp.toString()}`);
  };

  const go = (p: number) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('page', String(p));
    router.replace(`/artists?${sp.toString()}`);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-4">Artists</h1>

      <div className="mb-4">
        <input
          className="input w-full sm:w-96"
          placeholder="Search artists…"
          defaultValue={q}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      {loading && rows.length === 0 ? (
        <p className="opacity-70 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="opacity-70 text-sm">No artists found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {rows.map((a) => (
            <Link
              key={String(a.id)}
              href={`/artist/${a.slug}`}
              className="group block rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.card_img_url || '/placeholder/nas-card.jpg'}
                alt={a.name}
                className="w-full aspect-square object-cover"
              />
              <div className="p-2">
                <div className="font-semibold leading-tight group-hover:underline truncate">
                  {a.name}
                </div>
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
