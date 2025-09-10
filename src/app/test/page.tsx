'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient'; // relative path fix

type Artist = { id: number; name: string; slug: string };

export default function Test() {
  const [rows, setRows] = useState<Artist[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('artists')
      .select('id,name,slug')
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error(error);
          setErr(error.message);
        } else {
          setRows(data ?? []);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Artists</h1>

      {err ? (
        <p style={{ color: 'crimson' }}>Error: {err}</p>
      ) : (
        <pre
          style={{
            background: '#111',
            color: '#0f0',
            padding: 12,
            borderRadius: 8,
            overflowX: 'auto',
          }}
        >
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}

      <p style={{ marginTop: 12, opacity: 0.8 }}>
        Seeing an empty list? Seed one in Supabase SQL editor:
        <br />
        <code>
          insert into public.artists (name, slug, debut_year) values
          ('Nas','nas',1991) on conflict (slug) do nothing;
        </code>
      </p>
    </main>
  );
}
