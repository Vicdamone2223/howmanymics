'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: number;
  slug: string;
  topic: string;
  a_label: string;
  b_label: string;
  a_pct: number; // admin fallback
  b_pct: number; // admin fallback
  published_at: string | null;
};

export default function DebatesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // get published debates
      const { data } = await supabase
        .from('debates')
        .select('id,slug,topic,a_label,b_label,a_pct,b_pct,published_at')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false });

      const base = (data || []) as Row[];

      // For now (small list), fetch live counts per debate in parallel.
      // Falls back to admin a_pct/b_pct if zero votes.
      const withPct = await Promise.all(
        base.map(async (r) => {
          const [aRes, bRes] = await Promise.all([
            supabase
              .from('debate_votes')
              .select('*', { head: true, count: 'exact' })
              .eq('debate_id', r.id)
              .eq('choice', 'A'),
            supabase
              .from('debate_votes')
              .select('*', { head: true, count: 'exact' })
              .eq('debate_id', r.id)
              .eq('choice', 'B'),
          ]);

          const aCount = aRes.count ?? 0;
          const bCount = bRes.count ?? 0;
          const total = aCount + bCount;

          const aPct =
            total > 0 ? Math.round((aCount * 100) / total) : Math.round(r.a_pct || 0);
          const bPct =
            total > 0 ? 100 - aPct : Math.round(r.b_pct || 0);

          return { ...r, a_pct: aPct, b_pct: bPct };
        })
      );

      setRows(withPct);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-4">Debates</h1>

      {loading ? (
        <div className="opacity-70 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="opacity-70 text-sm">No debates yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/debates/${r.slug}`}
              className="rounded-lg border border-zinc-800 p-3 hover:border-zinc-600"
            >
              <div className="text-xs uppercase opacity-60 mb-1">Debate</div>
              <div className="font-semibold leading-snug">{r.topic}</div>
              <div className="text-xs opacity-75 mt-1">
                {r.a_label}: {r.a_pct}% • {r.b_label}: {r.b_pct}%
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
