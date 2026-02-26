'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type DebateRow = {
  id: number;
  slug: string;
  topic: string;
  a_label: string;
  b_label: string;
  a_pct: number; // fallback display if 0 votes
  b_pct: number; // fallback display if 0 votes
  href: string | null;
  published_at: string | null;
};

export default function DebateDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const search = useSearchParams();

  const [row, setRow] = useState<DebateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [voteLoading, setVoteLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [aCount, setACount] = useState<number>(0);
  const [bCount, setBCount] = useState<number>(0);
  const [myChoice, setMyChoice] = useState<'A' | 'B' | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  // % helper
  const perc = useMemo(() => {
    const total = aCount + bCount;
    if (total <= 0) {
      // fallback to admin-entered starting pct
      return row
        ? { a: Math.round(row.a_pct), b: Math.round(row.b_pct) }
        : { a: 0, b: 0 };
    }
    return {
      a: Math.round((aCount * 100) / total),
      b: Math.round((bCount * 100) / total),
    };
  }, [aCount, bCount, row]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // auth (for "one vote per user")
        const { data: sess } = await supabase.auth.getSession();
        setUid(sess.session?.user?.id ?? null);

        // debate by slug
        const { data, error } = await supabase
          .from('debates')
          .select('id,slug,topic,a_label,b_label,a_pct,b_pct,href,published_at')
          .eq('slug', slug)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setRow(null);
          setLoading(false);
          return;
        }
        setRow(data as DebateRow);

        // counts
        const a = await supabase
          .from('debate_votes')
          .select('*', { count: 'exact', head: true })
          .eq('debate_id', data.id)
          .eq('choice', 'A');
        const b = await supabase
          .from('debate_votes')
          .select('*', { count: 'exact', head: true })
          .eq('debate_id', data.id)
          .eq('choice', 'B');
        setACount(a.count ?? 0);
        setBCount(b.count ?? 0);

        // my vote
        if (sess.session?.user?.id) {
          const { data: mine } = await supabase
            .from('debate_votes')
            .select('choice')
            .eq('debate_id', data.id)
            .eq('user_id', sess.session.user.id)
            .maybeSingle();
          if (mine?.choice === 'A' || mine?.choice === 'B') setMyChoice(mine.choice);
        }

        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || 'Could not load debate.');
        setLoading(false);
      }
    })();
  }, [slug]);

  // Optional: handle ?vote=A|B deep-link (casts vote if signed in)
  useEffect(() => {
    const want = search.get('vote');
    if ((want === 'A' || want === 'B') && row && uid && myChoice !== want && !voteLoading) {
      handleVote(want).then(() => {
        const url = `/debates/${encodeURIComponent(slug)}`;
        router.replace(url);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, row, uid, myChoice, voteLoading]);

  async function refreshCounts(debateId: number) {
    const a = await supabase
      .from('debate_votes')
      .select('*', { count: 'exact', head: true })
      .eq('debate_id', debateId)
      .eq('choice', 'A');
    const b = await supabase
      .from('debate_votes')
      .select('*', { count: 'exact', head: true })
      .eq('debate_id', debateId)
      .eq('choice', 'B');
    setACount(a.count ?? 0);
    setBCount(b.count ?? 0);
  }

  async function handleVote(choice: 'A' | 'B') {
    if (!row) return;
    setErr(null);

    // must sign in
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user?.id ?? null;
    if (!userId) {
      alert('Please sign in to vote.');
      return;
    }

    setVoteLoading(true);
    try {
      // upsert: one vote per user per debate
      const { error } = await supabase
        .from('debate_votes')
        .upsert(
          { debate_id: row.id, user_id: userId, choice },
          { onConflict: 'debate_id,user_id' }
        );
      if (error) throw error;

      setMyChoice(choice);
      await refreshCounts(row.id);
    } catch (e: any) {
      setErr(e?.message || 'Could not save vote.');
    } finally {
      setVoteLoading(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8">Loading…</main>;
  if (!row) return notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4">
        <Link href="/debates" className="text-sm underline opacity-75 hover:opacity-100">← Back</Link>
      </div>

      <h1 className="text-2xl font-extrabold mb-2">Debate</h1>
      <div className="opacity-80">{row.topic}</div>

      {row.href && (
        <div className="mt-3 text-sm">
          <a className="underline opacity-80 hover:opacity-100" href={row.href} target="_blank" rel="noopener noreferrer">
            Reference link
          </a>
        </div>
      )}

      {err && <div className="mt-4 rounded border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">{err}</div>}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          disabled={voteLoading}
          onClick={() => handleVote('A')}
          className={`rounded-lg border p-4 text-left ${
            myChoice === 'A' ? 'border-emerald-600 bg-emerald-950/30' : 'border-zinc-700 hover:bg-zinc-900/60'
          }`}
        >
          <div className="font-semibold">{row.a_label}</div>
          <div className="text-xs opacity-70 mt-1">{perc.a}%</div>
        </button>

        <button
          disabled={voteLoading}
          onClick={() => handleVote('B')}
          className={`rounded-lg border p-4 text-left ${
            myChoice === 'B' ? 'border-emerald-600 bg-emerald-950/30' : 'border-zinc-700 hover:bg-zinc-900/60'
          }`}
        >
          <div className="font-semibold">{row.b_label}</div>
          <div className="text-xs opacity-70 mt-1">{perc.b}%</div>
        </button>
      </div>

      <style jsx>{`
        button[disabled] { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </main>
  );
}
