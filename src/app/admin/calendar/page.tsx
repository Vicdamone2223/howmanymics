'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ReleasePicker from '@/components/ReleasePicker';

type Status = 'confirmed' | 'likely' | 'tentative';

type EventRow = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  status: 'confirmed' | 'likely' | 'tentative' | string | null;
  // stored denormalized fields for fast calendar rendering
  release_id: number | null;
  release_slug: string | null;
  cover_url: string | null;
};

function toISO(d: string) {
  // accepts "YYYY-MM-DD" or Date input strings, returns YYYY-MM-DD
  if (!d) return '';
  return String(d).slice(0, 10);
}

export default function AdminCalendarPage() {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<Status>('confirmed');

  // link to existing release (and denormalized fields)
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [releaseSlug, setReleaseSlug] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // -------- bootstrap ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data: meAdmin, error: adminErr } = await supabase.rpc('me_is_admin');
      if (adminErr || !meAdmin) {
        setOk(false);
        setLoading(false);
        return;
      }
      setOk(true);

      // load upcoming window (past 60 days → next 365 days)
      const now = new Date();
      const past = new Date(now); past.setDate(past.getDate() - 60);
      const future = new Date(now); future.setDate(future.getDate() + 365);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('id,title,date,status,release_id,release_slug,cover_url')
        .gte('date', past.toISOString().slice(0, 10))
        .lte('date', future.toISOString().slice(0, 10))
        .order('date', { ascending: true });

      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data || []) as EventRow[]);
      }
      setLoading(false);
    })();
  }, []);

  // whenever a release is picked, fetch its slug & cover to store denormalized
  async function onPickRelease(idStr: string) {
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      setReleaseId(null);
      setReleaseSlug(null);
      // do not clobber cover if user typed a custom one
      return;
    }
    setReleaseId(id);
    const { data, error } = await supabase
      .from('releases')
      .select('slug,cover_url,title')
      .eq('id', id)
      .single();
    if (!error && data) {
      setReleaseSlug(data.slug || null);
      // only auto-fill cover if not set by hand
      setCoverUrl(prev => prev ? prev : (data.cover_url || null));
      // convenience: if title is blank, prime it with release title
      setTitle(t => t || data.title || '');
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDate('');
    setStatus('confirmed');
    setReleaseId(null);
    setReleaseSlug(null);
    setCoverUrl(null);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!title.trim() || !date) {
      setErr('Title and date are required.');
      return;
    }
    const payload = {
      title: title.trim(),
      date: toISO(date),
      status,
      release_id: releaseId,
      release_slug: releaseSlug,
      cover_url: coverUrl && coverUrl.trim() ? coverUrl.trim() : null,
    };

    if (editingId) {
      const { error } = await supabase.from('calendar_events').update(payload).eq('id', editingId);
      if (error) return setErr(error.message);
      // update local list
      setRows(prev =>
        prev.map(r => (r.id === editingId ? { ...r, ...payload } as EventRow : r))
      );
    } else {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert(payload)
        .select('id,title,date,status,release_id,release_slug,cover_url')
        .single();
      if (error) return setErr(error.message);
      setRows(prev => [...prev, data as EventRow].sort((a, b) => a.date.localeCompare(b.date)));
    }
    resetForm();
    // refresh calendar view cache if it’s open in another tab
    router.refresh();
  }

  async function editRow(r: EventRow) {
    setEditingId(r.id);
    setTitle(r.title || '');
    setDate(toISO(r.date) || '');
    // Runtime-narrow status to our union
    const s = r.status;
    if (s === 'confirmed' || s === 'likely' || s === 'tentative') {
      setStatus(s);
    } else {
      setStatus('confirmed');
    }
    setReleaseId(r.release_id ?? null);
    setReleaseSlug(r.release_slug ?? null);
    setCoverUrl(r.cover_url ?? null);
  }

  async function deleteRow(id: number) {
    if (!confirm('Delete this event?')) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) return alert(error.message);
    setRows(prev => prev.filter(r => r.id !== id));
    if (editingId === id) resetForm();
  }

  const upcoming = useMemo(() => rows.slice().sort((a, b) => a.date.localeCompare(b.date)), [rows]);

  // ------------- UI -------------
  if (ok === null || loading) {
    return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  }
  if (ok === false) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="mt-2 text-sm opacity-80">You don’t have access.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Manage Calendar</h1>
        <nav className="text-sm">
          <Link className="underline opacity-80 hover:opacity-100 mr-4" href="/admin">← Admin Home</Link>
          <Link className="underline opacity-80 hover:opacity-100" href="/calendar">View Calendar →</Link>
        </nav>
      </div>

      {err && (
        <div className="mb-4 text-sm rounded border border-red-900 bg-red-950/40 p-3 text-red-300">
          {err}
        </div>
      )}

      {/* Form */}
      <form onSubmit={saveEvent} className="rounded-xl border border-zinc-800 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        <input
          className="input"
          placeholder="Title (e.g., Artist — Album)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
        <input
          type="date"
          className="input"
          placeholder="Date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />

        <div>
          <label className="text-xs opacity-70 block mb-1">Link an existing album (optional)</label>
          <ReleasePicker value={releaseId ? String(releaseId) : ''} onChange={onPickRelease} />
          {releaseSlug ? (
            <div className="mt-1 text-xs opacity-80">
              Will link to: <code className="opacity-100">/release/{releaseSlug}</code>
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-xs opacity-70 block mb-1">Cover image override (optional)</label>
          <input
            className="input w-full"
            placeholder="https://… (leave blank to use album cover)"
            value={coverUrl || ''}
            onChange={e => setCoverUrl(e.target.value || null)}
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="opacity-70">Status:</span>
            <select
              className="input"
              value={status}
              onChange={e => setStatus(e.target.value as Status)}
            >
              <option value="confirmed">Confirmed</option>
              <option value="likely">Likely</option>
              <option value="tentative">Tentative</option>
            </select>
          </label>

          <button className="btn ml-auto" type="submit">
            {editingId ? 'Save Changes' : 'Add Event'}
          </button>
          {editingId && (
            <button
              type="button"
              className="text-xs px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-900"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Table of upcoming events */}
      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="text-sm opacity-70">No events yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left opacity-70">
                <tr>
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Title</th>
                  <th className="py-1 pr-3">Linked Album</th>
                  <th className="py-1 pr-3">Status</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(r => (
                  <tr key={r.id} className="border-t border-zinc-800">
                    <td className="py-2 pr-3 tabular-nums">{toISO(r.date)}</td>
                    <td className="py-2 pr-3">{r.title}</td>
                    <td className="py-2 pr-3">
                      {r.release_slug ? (
                        <Link className="underline opacity-90 hover:opacity-100" href={`/release/${r.release_slug}`}>/{r.release_slug}</Link>
                      ) : (
                        <span className="opacity-60">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{r.status || '—'}</td>
                    <td className="py-2 text-right">
                      <button
                        className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 mr-2"
                        onClick={() => editRow(r)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20"
                        onClick={() => deleteRow(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f4f4f5;
          outline: none;
          width: 100%;
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
