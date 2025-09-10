'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type RankedRow = {
  id: number | string;
  name: string;
  slug: string;
  card_img_url: string | null;
  rating_staff: number | null;
  people_avg: number | null;
  official: number | null;
  votes: number;
};

const PAGE_SIZE = 50;

export default function RankingsPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RankedRow[]>([]);
  const [totalArtists, setTotalArtists] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // total count (for pager); include everyone so we can page through all
      const { count } = await supabase
        .from('artists')
        .select('id', { count: 'exact', head: true });
      setTotalArtists(count || 0);

      const offset = (page - 1) * PAGE_SIZE;
      const { data, error } = await supabase
        .rpc('rank_artists', { p_offset: offset, p_limit: PAGE_SIZE });

      if (!error && data) setRows(data as RankedRow[]);
      setLoading(false);
    })();
  }, [page]);

  const totalPages = useMemo(() => {
    if (!totalArtists) return 1;
    return Math.max(1, Math.ceil(totalArtists / PAGE_SIZE));
  }, [totalArtists]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Rankings</h1>
        <Pager page={page} totalPages={totalPages} setPage={setPage} />
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="opacity-70 text-sm">No ranked artists yet.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-3">
          {rows.map((a, idx) => (
            <li key={String(a.id)} className="rounded-xl border border-zinc-800 p-3 bg-zinc-950/40">
              <div className="flex items-center gap-3">
                {/* rank number */}
                <span className="w-10 text-right pr-2 font-bold tabular-nums">
                  {(page - 1) * PAGE_SIZE + idx + 1}
                </span>

                {/* avatar */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.card_img_url || '/placeholder/nas-card.jpg'}
                  alt={a.name}
                  className="h-10 w-10 rounded-lg object-cover border border-zinc-800"
                />

                {/* name */}
                <Link href={`/artist/${a.slug}`} className="font-semibold hover:underline flex-1">
                  {a.name}
                </Link>

                {/* official score (single public metric) */}
                {a.official != null && (
                  <span className="text-sm px-2 py-1 rounded bg-orange-500/15 border border-orange-500/30 text-orange-300">
                    {a.official}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6">
        <Pager page={page} totalPages={totalPages} setPage={setPage} />
      </div>
    </main>
  );
}

function Pager({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="text-sm px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50"
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        ← Prev
      </button>
      <span className="text-sm opacity-80 tabular-nums">
        Page {page} / {totalPages}
      </span>
      <button
        className="text-sm px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50"
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        Next →
      </button>
    </div>
  );
}
