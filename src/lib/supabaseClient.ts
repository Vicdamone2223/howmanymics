import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Lazy runtime initializer. No client is created at module import time.
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error('Supabase URL missing/invalid at runtime');
  }
  if (!key) {
    throw new Error('Supabase anon key missing at runtime');
  }

  _client = createClient(url, key);
  return _client;
}

/**
 * Back-compat export: a lazy proxy that behaves like the client.
 * Existing imports like `import { supabase } from '@/lib/supabaseClient'`
 * will keep working, but the client is still created lazily.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const client = getSupabase();
    // @ts-ignore – dynamic property pass-through
    return client[prop];
  },
});
