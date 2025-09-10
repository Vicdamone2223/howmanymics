// src/app/admin/releases/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ReleaseRow = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
};

const PAGE_SIZE = 50;

export default function AdminReleasesPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // query UI
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'az'>('newest');
  const [page, setPage] = useState(1);

  // data
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [total, setTotal] = useState(0);

  // selection (bulk delete)
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  // ---------------- Load ----------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // admin gate
      const { data: meAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr || !meAdmin) {
        setOk(false);
        setLoading(false);
        return;
      }
      setOk(true);

      // build query
      let query = supabase
        .from('releases')
        .select('id,title,slug,cover_url,year', { count: 'exact' });

      if (q.trim()) {
        query = query.ilike('title', `%${q.trim()}%`);
      }

      // sort
      if (sort === 'newest') {
        // newest by year desc then id desc
        query = query.order('year', { ascending: false, nullsFirst: false })
                     .order('id', { ascending: false });
      } else if (sort === 'oldest') {
        query = query.order('year', { ascending: true, nullsFirst: true })
                     .order('id', { ascending: true });
      } else {
        // A–Z by title
        query = query.order('title', { ascending: true });
      }

      // pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        setErr(error.message);
        setRows([]);
        setTotal(0);
      } else {
        setRows((data || []) as ReleaseRow[]);
        setTotal(count || 0);
      }

      // clear stale selections when page changes
      setSelected(new Set());

      setLoading(false);
    })();
  }, [q, sort, page]);

  // ---------------- Bulk delete ----------------
  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllOnPage = () => {
    const ids = rows.map(r => r.id);
    const allOn = rows.every(r => selected.has(r.id));
    setSelected(prev => {
      if (allOn) {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      }
    });
  };
  const deleteSelected = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} album(s)? This cannot be undone.`)) return;

    const ids = Array.from(selected);
    const { error } = await supabase.from('releases').delete().in('id', ids);
    if (error) {
      alert(error.message);
      return;
    }
    // refresh current page
    // If we just deleted the whole last page, bump back one
    const remaining = total - ids.length;
    const lastPage = Math.max(1, Math.ceil(remaining / PAGE_SIZE));
    setPage(p => Math.min(p, lastPage));
    // trigger reload via dep change:
    setSelected(new Set());
    setTotal(remaining);
    // Easiest way: force a small re-run by bumping search to same value
    setQ(v => v);
  };

  // ---------------- UI ----------------
  if (ok === null) return <main className="mx-auto max-w-6xl px-4 py-8">Checking access…</main>;
  if (ok === false) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="mt-2 text-sm opacity-80">You don’t have access.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight flex-1">Manage Albums</h1>

        <div className="flex gap-2">
          <input
            className="input w-64"
            placeholder="Search title…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
          />
          <select
            className="input"
            value={sort}
            onChange={(e) => { setPage(1); setSort(e.target.value as any); }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      {err && (
        <div className="mb-4 text-sm rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-300">
          {err}
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <label className="text-sm inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={rows.length > 0 && rows.every(r => selected.has(r.id))}
            onChange={toggleAllOnPage}
          />
          <span>Select page</span>
        </label>
        <button
          className="text-sm px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20 disabled:opacity-40"
          onClick={deleteSelected}
          disabled={selected.size === 0}
        >
          Delete selected ({selected.size})
        </button>
        <div className="ml-auto text-xs opacity-70">
          {total.toLocaleString()} total • Page {page} / {totalPages}
        </div>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="opacity-70 text-sm">No albums found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg overflow-hidden border border-zinc-800">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.cover_url || '/placeholder/cover1.jpg'}
                  alt={r.title}
                  className="w-full aspect-square object-cover"
                />
                <label className="absolute top-2 left-2 bg-black/60 px-1.5 py-1 rounded text-xs inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                  />
                  <span>Select</span>
                </label>
              </div>
              <div className="p-2">
                <div className="font-semibold leading-tight truncate">{r.title}</div>
                <div className="text-xs opacity-70">{r.year ?? '—'}</div>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/release/${r.slug}`}
                    className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/releases/${r.slug}`}
                    className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* pagination */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          className="text-sm px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
          onClick={() => setPage(1)}
          disabled={page <= 1}
        >
          « First
        </button>
        <button
          className="text-sm px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          ‹ Prev
        </button>
        <span className="text-xs opacity-70">Page {page} of {totalPages}</span>
        <button
          className="text-sm px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next ›
        </button>
        <button
          className="text-sm px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-40"
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
        >
          Last »
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
