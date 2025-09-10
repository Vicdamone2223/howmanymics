// src/app/admin/artists/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Artist = {
  id: number | string;
  name: string;
  slug: string;
  card_img_url: string | null;
  staff_rank: number | null;
  rating_staff: number | null | string; // allow free typing
};

type UpdatePayload = {
  rating_staff?: number | null;
  staff_rank?: number | null;
};

export default function ManageArtistsPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Artist[]>([]);
  const [filter, setFilter] = useState('');

  // bulk delete state (always visible, like albums)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyDelete, setBusyDelete] = useState(false);

  // -------- load admin + all artists in chunks (no "S" cut off) --------
  useEffect(() => {
    (async () => {
      const { data: isAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr || !isAdmin) { setOk(false); return; }
      setOk(true);

      const all: Artist[] = [];
      const chunk = 1000;
      let from = 0;
      while (true) {
        const to = from + chunk - 1;
        const { data, error } = await supabase
          .from('artists')
          .select('id,name,slug,card_img_url,staff_rank,rating_staff')
          .order('name', { ascending: true })
          .range(from, to);
        if (error) { console.error(error); break; }
        const part = (data || []) as Artist[];
        all.push(...part);
        if (part.length < chunk) break;
        from += chunk;
      }
      setRows(all);
    })();
  }, []);

  // filter in-memory
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q)
    );
  }, [rows, filter]);

  // -------- inline save --------
  async function updateArtist(partial: Partial<Artist> & { id: Artist['id'] }) {
    const { id, rating_staff, staff_rank } = partial;

    // clamp staff rating ONLY on save
    let staffScore: number | null = null;
    if (rating_staff !== undefined) {
      const parsed = parseInt(String(rating_staff), 10);
      staffScore = Number.isFinite(parsed) ? Math.max(50, Math.min(100, parsed)) : null;
    }

    const payload: UpdatePayload = {};
    if (rating_staff !== undefined) payload.rating_staff = staffScore;
    if (staff_rank !== undefined) payload.staff_rank = staff_rank;

    const { error } = await supabase.from('artists').update(payload).eq('id', id);
    if (error) { alert(error.message); return false; }

    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)));
    return true;
  }

  // -------- bulk delete helpers (always visible) --------
  function toggleOne(id: number | string) {
    const key = String(id);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function selectAllShown() {
    const next = new Set(selected);
    shown.forEach(r => next.add(String(r.id)));
    setSelected(next);
  }
  function clearSelection() {
    setSelected(new Set());
  }
  async function deleteSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).map(s => Number(s));
    if (!confirm(`Delete ${ids.length} artist(s)? This cannot be undone.`)) return;

    setBusyDelete(true);
    try {
      const { error } = await supabase.from('artists').delete().in('id', ids);
      if (error) {
        alert(error.message + '\n\nTip: If an artist is linked to releases, the delete may fail due to foreign keys. Remove or reassign releases first.');
      } else {
        setRows(prev => prev.filter(r => !selected.has(String(r.id))));
        setSelected(new Set());
        alert('Deleted.');
      }
    } finally {
      setBusyDelete(false);
    }
  }

  // -------- UI --------
  if (ok === null) return <main className="mx-auto max-w-6xl px-4 py-8">Checking access…</main>;
  if (ok === false) return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-bold">Manage Artists</h1>
      <p className="opacity-80 mt-2 text-sm">You don’t have access.</p>
    </main>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Manage Artists</h1>
          <p className="text-sm opacity-75">Edit staff rating & rank. Tick artists and delete selected.</p>
        </div>
        <nav className="text-sm flex items-center gap-3">
          <Link href="/admin" className="opacity-80 hover:opacity-100 underline">Admin Home</Link>
          <Link href="/admin/releases" className="opacity-80 hover:opacity-100 underline">Manage Albums →</Link>
        </nav>
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input w-full sm:w-80"
          placeholder="Filter by name or slug…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button
          className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-900"
          onClick={selectAllShown}
          title="Select all currently shown (after filter)"
        >
          Select all shown
        </button>
        <button
          className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-900"
          onClick={clearSelection}
        >
          Clear selection
        </button>
        <button
          className="px-3 py-2 rounded border border-red-700 text-red-300 hover:bg-red-900/20 disabled:opacity-50"
          onClick={deleteSelected}
          disabled={busyDelete || selected.size === 0}
        >
          {busyDelete ? 'Deleting…' : `Delete selected (${selected.size})`}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="opacity-70 text-sm">No artists found.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {shown.map(a => {
            const isChecked = selected.has(String(a.id));
            return (
              <li key={String(a.id)} className="rounded-xl border border-zinc-800 p-3 bg-zinc-950/40">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-2"
                    checked={isChecked}
                    onChange={() => toggleOne(a.id)}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.card_img_url || '/placeholder/nas-card.jpg'}
                    alt={a.name}
                    className="h-14 w-14 rounded-lg object-cover border border-zinc-800"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{a.name}</div>
                        <div className="text-xs opacity-70 truncate">@{a.slug}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <Link
                          href={`/artist/${a.slug}`}
                          className="text-xs underline opacity-80 hover:opacity-100"
                          title="View public page"
                        >
                          View →
                        </Link>
                        <Link
                          href={`/admin/artists/${a.id}`}
                          className="text-xs underline opacity-80 hover:opacity-100"
                          title="Edit avatar & details"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>

                    {/* Inline edit row */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="block">
                        <div className="text-xs opacity-70 mb-1">Staff Rating (50–100)</div>
                        <input
                          type="number"            // free typing
                          inputMode="numeric"
                          className="input w-full"
                          value={a.rating_staff ?? ''}
                          onChange={e => {
                            const v = e.target.value; // keep as-is while typing
                            setRows(prev => prev.map(r => r.id === a.id ? { ...r, rating_staff: v } : r));
                          }}
                        />
                      </label>

                      <label className="block">
                        <div className="text-xs opacity-70 mb-1">Staff Rank (1..N)</div>
                        <input
                          type="number"
                          className="input w-full"
                          value={a.staff_rank ?? ''}
                          onChange={e => {
                            const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            setRows(prev => prev.map(r => r.id === a.id ? { ...r, staff_rank: v } : r));
                          }}
                        />
                      </label>

                      <div className="flex items-end gap-2">
                        <button
                          className="btn"
                          onClick={() =>
                            updateArtist({
                              id: a.id,
                              rating_staff: a.rating_staff,
                              staff_rank: a.staff_rank
                            })
                          }
                        >
                          Save
                        </button>
                        <button
                          className="text-xs px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-900"
                          onClick={() => window.location.reload()}
                          title="Reload from database"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
        .btn {
          background: #f97316; color: #000; font-weight: 700;
          border-radius: 0.5rem; padding: 0.55rem 0.9rem;
        }
      `}</style>
    </main>
  );
}
