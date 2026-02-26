// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

// Use a fixed storage key so we can find it in Application → Local Storage
const STORAGE_KEY = 'hmm-auth';

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error('Supabase URL missing/invalid at runtime');
  }
  if (!key) throw new Error('Supabase anon key missing at runtime');

  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY,
    },
  });

  return _client;
}

// Back-compat export
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    // @ts-ignore
    return c[prop];
  },
});
