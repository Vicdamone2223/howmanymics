'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function PingPage() {
  const [out, setOut] = useState<any>({ status: 'running' });

  useEffect(() => {
    (async () => {
      const started = Date.now();

      // basic public read probe
      const { data, error } = await supabase
        .from('releases')
        .select('id,title')
        .limit(1);

      setOut({
        ok: !error,
        error: error?.message ?? null,
        took_ms: Date.now() - started,
        sample: data ?? null,
        env: {
          url: String(process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined'),
          anonKeyPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        },
      });
    })();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-3">Supabase ping</h1>
      <pre className="text-sm whitespace-pre-wrap border border-zinc-700 rounded p-3">
        {JSON.stringify(out, null, 2)}
      </pre>
      <p className="text-xs opacity-70 mt-2">
        If <code>ok</code> is false or <code>anonKeyPresent</code> is false, that’s the root cause.
      </p>
    </main>
  );
}
