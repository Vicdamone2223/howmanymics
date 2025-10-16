'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Producer = {
  id: number | string;
  name: string;
  slug: string;
  card_img_url: string | null;
  origin: string | null;
  years_active: string | null;
  bio: string | null;
  rating_staff: number | null;

  // SEO + long-form sections (optional)
  seo_title?: string | null;
  seo_description?: string | null;

  bio_long_intro?: string | null;
  bio_long_early?: string | null;
  bio_long_breakthrough?: string | null;
  bio_long_discography?: string | null;
  bio_long_business?: string | null;
  bio_long_legacy?: string | null;
  bio_sources?: string | null;
};

type Release = {
  id: number | string;
  title: string;
  slug: string;
  year: number | null;
  cover_url: string | null;
};

export default function PageClient({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [producer, setProducer] = useState<Producer | null>(null);
  const [credits, setCredits] = useState<Release[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) producer
      const { data: pRow, error: pErr } = await supabase
        .from('producers')
        .select('*')
        .eq('slug', slug)
        .single();

      if (pErr || !pRow) { setLoading(false); return; }
      const p = pRow as Producer;
      setProducer(p);

      // 2) releases produced — try junction, then fall back to array column on releases
      let rels: Release[] = [];

      // try junction table release_producers(release_id, producer_id, position)
      const { data: rp } = await supabase
        .from('release_producers')
        .select('release:release_id (id,title,slug,year,cover_url)')
        .eq('producer_id', p.id)
        .order('position', { ascending: true });

      if (rp && rp.length) {
        rels = (rp as any[])
          .map(r => r.release)
          .filter(Boolean) as Release[];
      } else {
        // fallback: releases.producers is string[] (as per your admin create form)
        // .contains works with Postgres array columns
        const { data: relsByArray } = await supabase
          .from('releases')
          .select('id,title,slug,year,cover_url')
          .contains('producers', [p.name])
          .order('year', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false });
        rels = (relsByArray || []) as Release[];
      }

      setCredits(rels);
      setLoading(false);
    })();
  }, [slug]);

  const sections = useMemo(() => {
    if (!producer) return [];
    const S: Array<{ h: string; body: string | null | undefined }> = [
      { h: 'Overview', body: producer.bio_long_intro },
      { h: 'Early life & come-up', body: producer.bio_long_early },
      { h: 'Breakthrough & sound', body: producer.bio_long_breakthrough },
      { h: 'Discography & eras', body: producer.bio_long_discography },
      { h: 'Business & collaborations', body: producer.bio_long_business },
      { h: 'Legacy & influence', body: producer.bio_long_legacy },
    ];
    return S.filter(s => (s.body ?? '').trim().length > 0);
  }, [producer]);

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8">Loading…</main>;
  if (!producer) return <main className="mx-auto max-w-4xl px-4 py-8">Producer not found.</main>;

  const title = producer.seo_title || `${producer.name} — Producer Profile`;
  const desc =
    producer.seo_description || producer.bio || `Profile and selected credits for ${producer.name}.`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={producer.card_img_url || '/placeholder/nas-card.jpg'}
          alt={producer.name}
          className="h-28 w-28 rounded-xl object-cover border border-zinc-800"
        />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{producer.name}</h1>
          <p className="opacity-75 text-sm mt-1">{desc}</p>
          <div className="mt-2 text-xs opacity-70 flex flex-wrap gap-4">
            {producer.origin && <span>From: {producer.origin}</span>}
            {producer.years_active && <span>Years active: {producer.years_active}</span>}
            {producer.rating_staff != null && <span>HMM Staff: {producer.rating_staff}</span>}
          </div>
        </div>
      </header>

      {/* Short bio */}
      {producer.bio && (
        <section className="mt-6">
          <p className="leading-relaxed opacity-90">{producer.bio}</p>
        </section>
      )}

      {/* Long-form sections */}
      {sections.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold mb-3">Biography</h2>
          <div className="space-y-6">
            {sections.map((s, i) => (
              <article key={i}>
                <h3 className="text-lg font-semibold mb-1">{s.h}</h3>
                {(s.body || '').split(/\n{2,}/).map((para, j) => (
                  <p key={j} className="opacity-90 leading-relaxed mb-2">{para}</p>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Notable credits */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Notable Credits</h2>
          <Link href="/releases" className="text-sm underline opacity-80 hover:opacity-100">
            Browse all releases →
          </Link>
        </div>
        {credits.length === 0 ? (
          <p className="mt-2 opacity-70 text-sm">No credits found.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {credits.map(r => (
              <li key={String(r.id)} className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/40">
                <Link href={`/release/${r.slug}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.cover_url || '/placeholder/cover1.jpg'}
                    alt={r.title}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="p-2">
                    <div className="font-semibold truncate">{r.title}</div>
                    <div className="text-xs opacity-70">{r.year ?? '—'}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sources */}
      {producer.bio_sources && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-2">Sources</h2>
          <ul className="list-disc list-inside text-sm opacity-80 space-y-1">
            {producer.bio_sources.split('\n').map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              return (
                <li key={i}>
                  <a href={t} target="_blank" rel="noreferrer" className="underline">{t}</a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
