'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DebugAuth() {
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) setError(error.message);
        setSession(data?.session ?? null);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1 style={{ fontWeight: 800, marginBottom: 12 }}>Auth Debug</h1>
      {error && <pre style={{ color: 'tomato' }}>{error}</pre>}
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#111',
          border: '1px solid #333',
          padding: 12,
          borderRadius: 8,
        }}
      >
        {JSON.stringify(session, null, 2)}
      </pre>
    </main>
  );
}
