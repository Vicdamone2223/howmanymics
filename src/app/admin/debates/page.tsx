'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type DebateRow = {
  id: number;
  slug: string;
  topic: string;
  a_label: string;
  b_label: string;
  a_pct: number;
  b_pct: number;
  href: string | null;
  is_featured: boolean;
  published_at: string | null;
};

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function AdminDebates() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [rows, setRows] = useState<DebateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [topic, setTopic] = useState('');
  const [slug, setSlug] = useState('');
  const [aLabel, setALabel] = useState('Option A');
  const [bLabel, setBLabel] = useState('Option B');
  const [aPct, setAPct] = useState<number | ''>('');
  const [bPct, setBPct] = useState<number | ''>('');
  const [href, setHref] = useState('');
  const [featured, setFeatured] = useState(false);
  const [pubNow, setPubNow] = useState(true);

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

  useEffect(() => {
    if (!topic) return;
    if (!slug) setSlug(slugify(topic));
  }, [topic, slug]);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from('debates')
      .select('id,slug,topic,a_label,b_label,a_pct,b_pct,href,is_featured,published_at')
      .order('published_at', { ascending: false })
      .order('id', { ascending: false });
    if (error) setErr(error.message);
    setRows((data || []) as DebateRow[]);
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const a = aPct === '' ? 50 : Math.max(0, Math.min(100, Number(aPct)));
    const b = bPct === '' ? 50 : Math.max(0, Math.min(100, Number(bPct)));

    const payload = {
      slug: slugify(slug || topic),
      topic: topic.trim(),
      a_label: aLabel.trim() || 'Option A',
      b_label: bLabel.trim() || 'Option B',
      a_pct: a,
      b_pct: b,
      href: href.trim() || null,
      is_featured: featured,
      published_at: pubNow ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from('debates').insert(payload);
    if (error) {
      setErr(error.message);
      return;
    }
    setTopic(''); setSlug(''); setALabel('Option A'); setBLabel('Option B'); setAPct(''); setBPct(''); setHref('');
    setFeatured(false); setPubNow(true);
    await refresh();
    alert('Debate saved.');
  }

  async function del(id: number) {
    if (!confirm('Delete this debate?')) return;
    const { error } = await supabase.from('debates').delete().eq('id', id);
    if (error) return alert(error.message);
    await refresh();
  }

  async function toggleFeature(id: number, current: boolean) {
    const { error } = await supabase.from('debates').update({ is_featured: !current }).eq('id', id);
    if (error) return alert(error.message);
    await refresh();
  }

  async function publish(id: number) {
    const { error } = await supabase.from('debates').update({ published_at: new Date().toISOString() }).eq('id', id);
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
        <h1 className="text-2xl font-extrabold">Debate Spotlight — Admin</h1>
        <a href="/debates" className="text-sm underline opacity-80 hover:opacity-100">View public →</a>
      </div>

      {err && <div className="mb-4 rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-200">{err}</div>}

      <section className="rounded-xl border border-zinc-800 p-4 mb-8">
        <h2 className="text-lg font-bold mb-3">Create Debate</h2>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input sm:col-span-2" placeholder="Topic" value={topic} onChange={e=>setTopic(e.target.value)} required />
          <input className="input" placeholder="Slug (auto)" value={slug} onChange={e=>setSlug(e.target.value)} />
          <input className="input" placeholder="Option A label" value={aLabel} onChange={e=>setALabel(e.target.value)} />
          <input className="input" placeholder="Option B label" value={bLabel} onChange={e=>setBLabel(e.target.value)} />
          <input className="input" type="number" min={0} max={100} placeholder="A %" value={aPct} onChange={e=>setAPct(e.target.value === '' ? '' : parseInt(e.target.value))} />
          <input className="input" type="number" min={0} max={100} placeholder="B %" value={bPct} onChange={e=>setBPct(e.target.value === '' ? '' : parseInt(e.target.value))} />
          <input className="input sm:col-span-2" placeholder="Link (optional)" value={href} onChange={e=>setHref(e.target.value)} />
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)} /> Feature on homepage</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={pubNow} onChange={e=>setPubNow(e.target.checked)} /> Publish now</label>
          <button className="btn sm:col-span-2" type="submit">Save Debate</button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">All Debates</h2>
        {loading ? (
          <div className="opacity-70 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="opacity-70 text-sm">No debates yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {rows.map(r => (
              <li key={r.id} className="py-2 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <div>
                  <div className="font-semibold">{r.topic}</div>
                  <div className="text-xs opacity-70">
                    {r.a_label} {r.a_pct}% • {r.b_label} {r.b_pct}% {r.published_at ? '• Published' : '• Draft'}
                  </div>
                </div>
                <a className="text-xs underline opacity-80 hover:opacity-100" href={`/debates/${r.slug}`}>Open</a>
                <button onClick={()=>toggleFeature(r.id, r.is_featured)} className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900">{r.is_featured ? 'Unfeature' : 'Feature'}</button>
                <div className="flex items-center gap-2">
                  {!r.published_at && (
                    <button onClick={()=>publish(r.id)} className="text-xs px-2 py-1 rounded border border-green-700 text-green-300 hover:bg-green-900/20">Publish</button>
                  )}
                  <button onClick={()=>del(r.id)} className="text-xs px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20">Delete</button>
                </div>
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
