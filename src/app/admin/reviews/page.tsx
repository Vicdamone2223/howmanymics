'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Review = {
  id: number | string;
  release_id?: number | string | null;
  title?: string | null;
  outlet?: string | null;
  author?: string | null;
  url?: string | null;
  score?: number | null;
  published_at?: string | null;
};

export default function ReviewsAdminPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Admin gate
      const { data: isAdmin, error } = await supabase.rpc('me_is_admin');
      if (error) { setOk(false); setLoading(false); return; }
      setOk(!!isAdmin);
      if (!isAdmin) return;

      setLoading(true);
      setErr(null);
      const { data, error: qErr } = await supabase
        .from('reviews')
        .select('id,release_id,title,outlet,author,url,score,published_at')
        .order('published_at', { ascending: false })
        .limit(200);

      if (qErr) setErr(qErr.message);
      setRows((data || []) as Review[]);
      setLoading(false);
    })();
  }, []);

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-4xl px-4 py-8">You don’t have access.</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-4">Reviews Admin</h1>

      {err && <div className="mb-4 text-sm text-red-400">Error: {err}</div>}
      {loading && <div>Loading…</div>}

      {!loading && rows.length === 0 && (
        <div className="text-sm opacity-80">No reviews yet.</div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
          {rows.map((r) => (
            <li key={String(r.id)} className="p-3 text-sm">
              <div className="font-semibold">{r.title || '(untitled)'}</div>
              <div className="opacity-80">
                {r.outlet ? `${r.outlet}` : '—'}
                {r.author ? ` • ${r.author}` : ''}
                {r.published_at ? ` • ${new Date(r.published_at).toLocaleDateString()}` : ''}
                {typeof r.score === 'number' ? ` • ${r.score}` : ''}
              </div>
              {r.url && (
                <a className="underline opacity-90 hover:opacity-100" href={r.url} target="_blank" rel="noreferrer">
                  Open review
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
