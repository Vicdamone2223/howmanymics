'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: number;
  title: string;
  slug: string;
  kind: 'article' | 'review';
  featured_slider: boolean;
  published_at: string | null;
  cover_url: string | null;
};

export default function AdminArticlesPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: meAdmin } = await supabase.rpc('me_is_admin');
      if (!meAdmin) { setOk(false); setLoading(false); return; }
      setOk(true);

      let query = supabase.from('articles')
        .select('id,title,slug,kind,featured_slider,published_at,cover_url')
        .order('published_at', { ascending: false, nullsFirst: true })
        .order('id', { ascending: false });
      if (q.trim()) query = query.ilike('title', `%${q.trim()}%`);
      const { data } = await query;
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
  }, [q]);

  if (ok === null) return <main className="mx-auto max-w-6xl px-4 py-8">Checking…</main>;
  if (ok === false) return <main className="mx-auto max-w-6xl px-4 py-8">No access.</main>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Manage Articles</h1>
        <Link href="/admin/articles/new" className="text-sm px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">
          + New
        </Link>
      </div>

      <div className="mb-3">
        <input className="input w-80" placeholder="Search title…" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      {loading ? 'Loading…' : rows.length === 0 ? (
        <div className="opacity-70 text-sm">No articles yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <div key={r.id} className="rounded-lg overflow-hidden border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.cover_url || '/placeholder/hero.jpg'} alt={r.title} className="w-full h-40 object-cover" />
              <div className="p-2">
                <div className="font-semibold leading-tight truncate">{r.title}</div>
                <div className="text-xs opacity-70 mt-1">{r.kind} {r.featured_slider ? '• slider' : ''}</div>
                <div className="mt-2 flex gap-2">
                  <Link href={`/articles/${r.slug}`} className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">View</Link>
                  <Link href={`/admin/articles/${r.id}`} className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">Edit</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .input {
          background: #0a0a0a; border: 1px solid #27272a; border-radius: 0.5rem; padding: 0.5rem 0.75rem; color: #f4f4f5;
        }
      `}</style>
    </main>
  );
}
