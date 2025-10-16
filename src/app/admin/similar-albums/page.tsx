'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Release = { id: number; title: string; slug: string; year: number | null; cover_url: string | null };
type Pair = { id: number; release_id: number; similar_id: number; score: number; reason: string | null };

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function SimilarAlbumsAdmin() {
  const [ok, setOk] = useState<boolean | null>(null);

  const [releases, setReleases] = useState<Release[]>([]);
  const [leftQ, setLeftQ] = useState('');
  const [rightQ, setRightQ] = useState('');
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [score, setScore] = useState<string>('0.7');
  const [reason, setReason] = useState('');

  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: meAdmin, error } = await supabase.rpc('me_is_admin');
      if (error) { setOk(false); return; }
      setOk(!!meAdmin);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const acc: Release[] = [];
      const PAGE = 500;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('releases')
          .select('id,title,slug,year,cover_url')
          .order('year', { ascending: false })
          .order('title', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        if (!data?.length) break;
        acc.push(...(data as Release[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setReleases(acc);
    })();
  }, []);

  const leftList = useMemo(() => {
    const t = leftQ.trim();
    if (!t) return releases.slice(0, 2000);
    const s = slugify(t);
    const l = t.toLowerCase();
    return releases.filter(r =>
      r.title.toLowerCase().includes(l) || r.slug.toLowerCase().includes(s) || slugify(r.title).includes(s)
    );
  }, [leftQ, releases]);

  const rightList = useMemo(() => {
    const t = rightQ.trim();
    if (!t) return releases.slice(0, 2000);
    const s = slugify(t);
    const l = t.toLowerCase();
    return releases.filter(r =>
      r.title.toLowerCase().includes(l) || r.slug.toLowerCase().includes(s) || slugify(r.title).includes(s)
    );
  }, [rightQ, releases]);

  async function loadPairs(forReleaseId: string) {
    setLoadingPairs(true);
    const { data } = await supabase
      .from('release_similar')
      .select('id,release_id,similar_id,score,reason')
      .eq('release_id', forReleaseId)
      .order('score', { ascending: false })
      .order('id', { ascending: false });
    setPairs((data || []) as Pair[]);
    setLoadingPairs(false);
  }

  useEffect(() => {
    if (!leftId) { setPairs([]); return; }
    loadPairs(leftId);
  }, [leftId]);

  async function addPair(e: React.FormEvent) {
    e.preventDefault();
    if (!leftId || !rightId) { alert('Pick both albums.'); return; }
    if (leftId === rightId) { alert('Pick two different albums.'); return; }

    const payload = {
      release_id: Number(leftId),
      similar_id: Number(rightId),
      score: Number(score) || 0.7,
      reason: reason.trim() || null,
    };
    const { error } = await supabase.from('release_similar').insert(payload);
    if (error) return alert(error.message);
    setRightId(''); setScore('0.7'); setReason('');
    await loadPairs(leftId);
  }

  async function delPair(id: number) {
    if (!confirm('Remove this pairing?')) return;
    const { error } = await supabase.from('release_similar').delete().eq('id', id);
    if (error) return alert(error.message);
    if (leftId) await loadPairs(leftId);
  }

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-4xl px-4 py-8">No access.</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Admin • Similar Albums</h1>
        <nav className="text-sm flex gap-3 opacity-80">
          <a className="underline" href="/admin">← Back to Admin</a>
        </nav>
      </div>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Create pairing</h2>
        <form onSubmit={addPair} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <input className="input" placeholder="Search LEFT album…" value={leftQ} onChange={e => setLeftQ(e.target.value)} />
              <select className="input" value={leftId} onChange={e => setLeftId(e.target.value)}>
                <option value="">— Select left (the page this shows on) —</option>
                {leftList.map(r => <option key={r.id} value={r.id}>{r.title} {r.year ? `(${r.year})` : ''}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <input className="input" placeholder="Search RIGHT album…" value={rightQ} onChange={e => setRightQ(e.target.value)} />
              <select className="input" value={rightId} onChange={e => setRightId(e.target.value)} disabled={!leftId}>
                <option value="">— Select right (recommended) —</option>
                {rightList
                  .filter(r => String(r.id) !== String(leftId))
                  .map(r => <option key={r.id} value={r.id}>{r.title} {r.year ? `(${r.year})` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <input className="input" placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
            <input className="input" type="number" step="0.05" min="0" max="1" value={score} onChange={e => setScore(e.target.value)} placeholder="Score 0–1" />
            <button className="btn" type="submit" disabled={!leftId || !rightId}>Save Pair</button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold mb-3">Existing pairs for LEFT album</h2>
        {loadingPairs ? (
          <div className="text-sm opacity-75">Loading…</div>
        ) : !leftId ? (
          <div className="text-sm opacity-75">Pick a LEFT album to view.</div>
        ) : pairs.length === 0 ? (
          <div className="text-sm opacity-75">No pairs yet.</div>
        ) : (
          <ul className="space-y-3">
            {pairs.map(p => (
              <li key={p.id} className="rounded border border-zinc-800 p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <strong>similar_id:</strong> {p.similar_id} &nbsp;•&nbsp; <strong>score:</strong> {p.score}
                  {p.reason ? <> &nbsp;•&nbsp; {p.reason}</> : null}
                </div>
                <button className="text-red-300 underline" onClick={() => delPair(p.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx>{`
        .input{background:#0a0a0a;border:1px solid #27272a;border-radius:0.5rem;padding:0.5rem 0.75rem;color:#f4f4f5;outline:none}
        .input::placeholder{color:#a1a1aa}
        .input:focus{box-shadow:0 0 0 2px rgba(249,115,22,.35)}
        .btn{background:#f97316;color:#000;font-weight:700;border-radius:.5rem;padding:.55rem .9rem}
      `}</style>
    </main>
  );
}
