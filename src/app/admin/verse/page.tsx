'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type Row = {
  id?: number;
  month: string;            // 'YYYY-MM'
  artist_name: string;
  song_title: string;
  instagram_url: string;
};

function currentYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

export default function AdminVersePage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({
    month: currentYYYYMM(),
    artist_name: '',
    song_title: '',
    instagram_url: ''
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: meAdmin, error } = await supabase.rpc('me_is_admin');
      if (error || !meAdmin) { setOk(false); return; }
      setOk(true);

      const { data } = await supabase
        .from('verse_of_month')
        .select('id,month,artist_name,song_title,instagram_url')
        .order('month', { ascending: false })
        .limit(24);

      setRows((data || []) as Row[]);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.month || !form.artist_name || !form.song_title || !form.instagram_url) {
      setErr('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      // upsert by month (unique)
      const { error } = await supabase
        .from('verse_of_month')
        .upsert(
          { month: form.month, artist_name: form.artist_name.trim(), song_title: form.song_title.trim(), instagram_url: form.instagram_url.trim() },
          { onConflict: 'month' }
        );
      if (error) throw error;

      const { data } = await supabase
        .from('verse_of_month')
        .select('id,month,artist_name,song_title,instagram_url')
        .order('month', { ascending: false })
        .limit(24);

      setRows((data || []) as Row[]);
      alert('Saved.');
    } catch (e: any) {
      setErr(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number | undefined) {
    if (!id) return;
    if (!confirm('Delete this month?')) return;
    const { error } = await supabase.from('verse_of_month').delete().eq('id', id);
    if (error) return alert(error.message);
    setRows(prev => prev.filter(r => r.id !== id));
  }

  if (ok === null) return <main className="mx-auto max-w-3xl p-6">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-3xl p-6">No access.</main>;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Verse of the Month</h1>
        <Link href="/admin" className="text-sm underline opacity-80 hover:opacity-100">← Admin Home</Link>
      </div>

      {err && <div className="mb-3 text-sm rounded border border-red-900 bg-red-950/40 p-2 text-red-300">{err}</div>}

      <form onSubmit={save} className="grid gap-3 rounded-xl border border-zinc-800 p-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm opacity-70">Month (YYYY-MM)</label>
          <input className="input" placeholder="2025-09" value={form.month} onChange={e=>setForm(f=>({...f, month: e.target.value}))} />
          <label className="text-sm opacity-70">Artist</label>
          <input className="input" value={form.artist_name} onChange={e=>setForm(f=>({...f, artist_name: e.target.value}))} />
          <label className="text-sm opacity-70">Song</label>
          <input className="input" value={form.song_title} onChange={e=>setForm(f=>({...f, song_title: e.target.value}))} />
          <label className="text-sm opacity-70">Instagram URL (post or reel)</label>
          <input className="input" value={form.instagram_url} onChange={e=>setForm(f=>({...f, instagram_url: e.target.value}))} />
        </div>
        <div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>

      <section className="mt-8 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Recent entries</h2>
        {rows.length === 0 ? (
          <div className="opacity-70 text-sm">None yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {rows.map(r => (
              <li key={r.id} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.month} — {r.artist_name} — <span className="opacity-80">{r.song_title}</span></div>
                  <div className="text-xs opacity-70 truncate">{r.instagram_url}</div>
                </div>
                <button className="text-xs px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20" onClick={()=>remove(r.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx>{`
        .input { background:#0a0a0a; border:1px solid #27272a; border-radius:0.5rem; padding:0.5rem 0.75rem; color:#f4f4f5; outline:none; }
        .input::placeholder { color:#a1a1aa; }
        .input:focus { box-shadow:0 0 0 2px rgba(249,115,22,0.35); }
        .btn { background:#f97316; color:#000; font-weight:700; border-radius:0.5rem; padding:0.55rem 0.9rem; }
      `}</style>
    </main>
  );
}
