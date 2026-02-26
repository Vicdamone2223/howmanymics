'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthInit() {
  useEffect(() => {
    supabase.auth.getSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
