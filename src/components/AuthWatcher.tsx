'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Explicitly refreshes the Supabase session when the tab becomes visible,
 * and on a small interval, so the UI never gets stuck on a stale token.
 */
export default function AuthWatcher() {
  useEffect(() => {
    let interval: any;

    async function refresh() {
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) console.error('auth refresh error:', error.message);
      } catch (e) {
        console.error('auth refresh threw:', e);
      }
    }

    function onVisChange() {
      if (document.visibilityState === 'visible') refresh();
    }

    document.addEventListener('visibilitychange', onVisChange);
    interval = setInterval(refresh, 5 * 60 * 1000); // every 5 minutes

    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      clearInterval(interval);
    };
  }, []);

  return null;
}
