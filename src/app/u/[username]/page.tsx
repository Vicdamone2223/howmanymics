'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  instagram: string | null;
};

type RatingRow = {
  rating: number;
  created_at: string;
  releases?: { slug: string; title: string; cover_url: string | null } | null;
};

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);

  useEffect(() => {
    (async () => {
      // load profile by username (case-insensitive)
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', username)
        .limit(1);

      const row = prof?.[0] as Profile | undefined;
      if (!row) { setLoading(false); setP(null); return; }
      setP(row);

      // latest ratings by this user (if you store user_id in release_ratings)
      const { data: rr } = await supabase
        .from('release_ratings')
        .select('rating,created_at,releases(slug,title,cover_url)')
        .eq('user_id', row.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setRatings((rr || []) as RatingRow[]);
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.avatar_url || '/placeholder/cover1.jpg'}
          alt={p.display_name || p.username || 'User'}
          className="h-24 w-24 rounded-full object-cover border border-zinc-800"
        />
        <div>
          <h1 className="text-2xl font-extrabold">
            {p.display_name || p.username}
          </h1>
          {p.username && <div className="opacity-70">@{p.username}</div>}
          {p.location && <div className="opacity-70 text-sm mt-1">{p.location}</div>}
          {p.bio && <p className="mt-3 opacity-90 max-w-2xl">{p.bio}</p>}
          <div className="mt-3 flex items-center gap-3 text-sm opacity-80">
            {p.website && <a className="underline" href={p.website} target="_blank">Website</a>}
            {p.twitter && <a className="underline" href={`https://twitter.com/${p.twitter}`} target="_blank">Twitter</a>}
            {p.instagram && <a className="underline" href={`https://instagram.com/${p.instagram}`} target="_blank">Instagram</a>}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <section className="mt-10">
        <h2 className="text-lg font-bold mb-3">Recent ratings</h2>
        {ratings.length === 0 ? (
          <div className="opacity-70 text-sm">No ratings yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ratings.map((r, i) => (
              <Link
                key={i}
                href={r.releases ? `/release/${r.releases.slug}` : '#'}
                className="block rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.releases?.cover_url || '/placeholder/cover1.jpg'}
                  alt={r.releases?.title || 'Album'}
                  className="w-full h-36 object-cover"
                />
                <div className="p-2 text-sm">
                  <div className="font-semibold truncate">{r.releases?.title || 'Unknown album'}</div>
                  <div className="opacity-70">Score: <strong className="tabular-nums">{r.rating}</strong></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
