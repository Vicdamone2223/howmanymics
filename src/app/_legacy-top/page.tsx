'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Row = {
  id: number;
  slug: string;
  title: string;
  artist_name: string;
  avg_score: number | null;
  votes: number;
  wilson: number;
};

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('v_top_releases')
      .select('id,slug,title,artist_name,avg_score,votes,wilson')
      .order('wilson', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRows(data || []);
      });
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Top Releases (community)</h1>
      {err && <p style={{ color: 'crimson' }}>Error: {err}</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((r) => (
          <a key={r.id} href={`/release/${r.slug}`} style={{ padding: 12, border: '1px solid #222', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.title}</div>
                <div style={{ opacity: .8, fontSize: 13 }}>{r.artist_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Avg: <b>{r.avg_score !== null ? Math.round(r.avg_score) : '—'}</b></div>
                <div style={{ opacity: .8, fontSize: 13 }}>{r.votes} votes</div>
              </div>
            </div>
          </a>
        ))}
        {rows.length === 0 && <p>No releases yet. Rate one to see it appear.</p>}
      </div>
    </main>
  );
}
