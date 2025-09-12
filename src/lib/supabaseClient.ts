// src/lib/supabaseClient.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

// --- TEMP: nuke corrupted auth JSON if present (prevents hard-brick) ---
function sanitizeSupabaseAuthStorage(projectRef: string) {
  if (typeof window === 'undefined') return;
  const key = `sb-${projectRef}-auth-token`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    // Some browsers/extensions can truncate this JSON. Validate it.
    const parsed = JSON.parse(raw);
    // Minimal shape check; if it fails, clear it so supabase can re-login.
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.currentSession ||
      !parsed.expiresAt
    ) {
      throw new Error('invalid shape');
    }
  } catch {
    // If parsing fails or shape is wrong, clear the item. User will still be logged in
    // after a silent refresh; worst case they need to sign in once again.
    try { localStorage.removeItem(`sb-${projectRef}-auth-token`); } catch {}
  }
}

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

  // project ref is the middle piece of the URL: https://<ref>.supabase.co
  const projectRef = (new URL(url)).hostname.split('.')[0];
  sanitizeSupabaseAuthStorage(projectRef);

  _client = createClient(url, key);
  return _client;
}

// Back-compat proxy
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const client = getSupabase();
    // @ts-ignore dynamic pass-through
    return client[prop];
  },
});
