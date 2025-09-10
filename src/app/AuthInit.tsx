'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthInit() {
  useEffect(() => {
    // Touch auth on mount so Supabase parses the URL hash and stores the session
    supabase.auth.getSession();
    // Optional: keep listener alive (not strictly required)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {});
    return () => { sub.subscription.unsubscribe(); };
  }, []);
  return null;
}
