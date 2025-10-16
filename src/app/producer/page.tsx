'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Producer = {
  id: number | string;
  name: string;
  slug: string;
  card_img_url: string | null;
  rating_staff: number | null; // optional, if you track it
};

export default function ProducersIndexPage() {
  const [rows, setRows] = useState<Producer[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const PAGE = 500;
      const all: Producer[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('producers')
          .select('id,name,slug,card_img_url,rating_staff')
          .order('name', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        const part = (data || []) as Producer[];
        all.push(...part);
        if (part.length < PAGE) break;
        from += PAGE;
      }
      setRows(all);
      setLoading(false);
    })();
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(t) || r.slug.toLowerCase().includes(t));
  }, [rows, q]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Producers</h1>

      <div className="mt-4 flex gap-2">
        <input
          className="input w-80"
          placeholder="Search producers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="mt-6 opacity-70">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 opacity-70">No producers found.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {shown.map(p => (
            <li key={String(p.id)} className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/40">
              <Link href={`/producer/${p.slug}`} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.card_img_url || '/placeholder/nas-card.jpg'}
                  alt={p.name}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2">
                  <div className="font-semibold truncate">{p.name}</div>
                  {p.rating_staff != null && (
                    <div className="text-xs opacity-70">Staff: {p.rating_staff}</div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .input {
          background:#0a0a0a; border:1px solid #27272a; border-radius:0.5rem;
          padding:0.5rem 0.75rem; color:#f4f4f5; outline:none;
        }
        .input::placeholder { color:#a1a1aa; }
        .input:focus { box-shadow: 0 0 0 2px rgba(249,115,22,0.35); }
      `}</style>
    </main>
  );
}
