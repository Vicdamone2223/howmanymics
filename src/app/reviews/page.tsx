'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  published_at: string | null;
  kind: 'article' | 'review' | null;
  release_id: number | null;
  is_published: boolean | null;
};

export default function ReviewsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Pull the core fields we need; RLS shows only published
      const { data } = await supabase
        .from('articles')
        .select('id,title,slug,cover_url,excerpt,published_at,kind,release_id,is_published')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      const all = (data || []) as Row[];

      // Treat as "review" if explicitly kind='review' OR has a release_id
      const onlyReviews = all.filter(
        r => r.kind === 'review' || (r.release_id != null)
      );

      setRows(onlyReviews);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-8">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-4">Reviews</h1>
      {rows.length === 0 ? (
        <div className="opacity-70 text-sm">No reviews yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <Link
              key={r.id}
              href={`/articles/${r.slug}`}
              className="group rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.cover_url || '/placeholder/hero.jpg'}
                alt={r.title}
                className="w-full h-44 object-cover"
              />
              <div className="p-3">
                <div className="font-semibold leading-tight group-hover:underline">{r.title}</div>
                {r.published_at && (
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(r.published_at).toLocaleDateString()}
                  </div>
                )}
                {r.excerpt && <p className="text-sm opacity-80 line-clamp-2 mt-1">{r.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
