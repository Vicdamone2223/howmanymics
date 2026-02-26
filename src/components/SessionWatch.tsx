'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SessionWatch() {
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    // Log the initial session state
    supabase.auth.getSession().then(({ data }) => {
      setMsg(`auth: ${data.session ? 'SIGNED_IN' : 'SIGNED_OUT'}`);
    });

    // Show auth transitions that happen when you switch tabs/return
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      setMsg(`auth event: ${event} @ ${new Date().toLocaleTimeString()}`);
    });

    // Visibility changes are when refresh tokens get exercised
    const onVis = () => setMsg(`visibility: ${document.visibilityState} @ ${new Date().toLocaleTimeString()}`);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Small pill in the corner; harmless in prod and easy to remove later
  return (
    <div style={{
      position: 'fixed', right: 8, bottom: 8, zIndex: 99999,
      padding: '6px 10px', borderRadius: 10, fontSize: 12,
      background: 'rgba(34,34,34,.8)', border: '1px solid #333'
    }}>
      {msg || 'auth: ???'}
    </div>
  );
}
