// src/components/DebugTrap.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DebugTrap() {
  const [msgs, setMsgs] = useState<string[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes('debug=1')) return;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSessionEmail(data.session?.user?.email ?? null);
      } catch (e: any) {
        setMsgs(m => [...m, `auth.getSession error: ${e?.message || e}`]);
      }
    })();

    const onErr = (e: ErrorEvent) => setMsgs(m => [...m, `error: ${e.message}`]);
    const onRej = (e: PromiseRejectionEvent) =>
      setMsgs(m => [...m, `unhandledrejection: ${String(e.reason)}`]);

    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  if (typeof window === 'undefined') return null;
  if (!window.location.search.includes('debug=1')) return null;

  return (
    <div
      style={{
        position: 'fixed', bottom: 12, right: 12, zIndex: 99999,
        maxWidth: 420, background: '#111', color: '#fff', border: '1px solid #333',
        borderRadius: 10, padding: '10px 12px', fontSize: 12, lineHeight: 1.4,
      }}
    >
      <div style={{opacity:.7, marginBottom: 6}}>DebugTrap</div>
      <div><b>session:</b> {sessionEmail ?? '(none)'}</div>
      {msgs.length ? (
        <ul style={{margin:'6px 0 0 18px'}}>
          {msgs.slice(-8).map((m,i)=>(<li key={i}>{m}</li>))}
        </ul>
      ) : <div style={{opacity:.7}}>no errors yet</div>}
    </div>
  );
}
