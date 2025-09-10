'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: number;
  month: number;
  day: number;
  type: 'anniv' | 'birthday' | 'news';
  text: string;
  href: string | null;
};

export default function AdminToday() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [day, setDay] = useState<number>(new Date().getDate());
  const [type, setType] = useState<'anniv' | 'birthday' | 'news'>('anniv');
  const [text, setText] = useState('');
  const [href, setHref] = useState('');

  useEffect(() => {
    (async () => {
      const { data: isAdmin, error: e1 } = await supabase.rpc('me_is_admin');
      if (e1 || !isAdmin) {
        setOk(false);
        setLoading(false);
        return;
      }
      setOk(true);
      await refresh();
    })();
  }, []);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from('today_in_hiphop')
      .select('id,month,day,type,text,href')
      .order('month', { ascending: true })
      .order('day', { ascending: true });
    if (error) setErr(error.message);
    setRows((data || []) as Row[]);
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload = {
      month,
      day,
      type,
      text: text.trim(),
      href: href.trim() || null,
    };
    const { error } = await supabase.from('today_in_hiphop').insert(payload);
    if (error) {
      setErr(error.message);
      return;
    }
    setText('');
    setHref('');
    await refresh();
    alert('Saved.');
  }

  async function del(id: number) {
    if (!confirm('Delete this entry?')) return;
    const { error } = await supabase.from('today_in_hiphop').delete().eq('id', id);
    if (error) return alert(error.message);
    await refresh();
  }

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking access…</main>;
  if (ok === false) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="mt-2 text-sm opacity-80">You don’t have access.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Today in Hip-Hop — Admin</h1>
        <a href="/today" className="text-sm underline opacity-80 hover:opacity-100">View public →</a>
      </div>

      {err && <div className="mb-4 rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-200">{err}</div>}

      <section className="rounded-xl border border-zinc-800 p-4 mb-8">
        <h2 className="text-lg font-bold mb-3">Add Entry</h2>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" min={1} max={12} placeholder="Month (1–12)" value={month} onChange={e=>setMonth(parseInt(e.target.value||'1'))} />
            <input className="input" type="number" min={1} max={31} placeholder="Day (1–31)" value={day} onChange={e=>setDay(parseInt(e.target.value||'1'))} />
          </div>
          <select className="input" value={type} onChange={e=>setType(e.target.value as any)}>
            <option value="anniv">Anniversary</option>
            <option value="birthday">Birthday</option>
            <option value="news">News</option>
          </select>
          <input className="input sm:col-span-2" placeholder="Text" value={text} onChange={e=>setText(e.target.value)} />
          <input className="input sm:col-span-2" placeholder="Link (optional)" value={href} onChange={e=>setHref(e.target.value)} />
          <button className="btn sm:col-span-2" type="submit">Save</button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">All Entries</h2>
        {loading ? (
          <div className="opacity-70 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="opacity-70 text-sm">No items yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {rows.map(r => (
              <li key={r.id} className="py-2 flex items-center gap-3">
                <span className="text-xs rounded border border-zinc-700 px-1.5 py-0.5">{String(r.month).padStart(2,'0')}/{String(r.day).padStart(2,'0')}</span>
                <span className="text-xs rounded border border-zinc-700 px-1.5 py-0.5">{r.type}</span>
                <span className="flex-1 text-sm">{r.text}</span>
                {r.href && <a href={r.href} target="_blank" className="text-xs underline opacity-80 hover:opacity-100">Link</a>}
                <button onClick={()=>del(r.id)} className="text-xs px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20">Delete</button>
              </li>
            ))}
          </ul>
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
        }
        .btn { background:#f97316;color:#000;font-weight:700;border-radius:0.5rem;padding:0.6rem 0.9rem; }
      `}</style>
    </main>
  );
}
