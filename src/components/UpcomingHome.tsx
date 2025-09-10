'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: number;
  date: string;          // YYYY-MM-DD
  title: string | null;  // fallback if no linked release
  release: {
    slug: string | null;
    title: string | null;
    cover_url: string | null;
  } | null;
};

export default function UpcomingHome() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('calendar_events')
        .select(`
          id, date, title,
          release:releases (
            slug, title, cover_url
          )
        `)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(8);

      if (!error && data) {
        setRows(
          data.map((r: any) => ({
            id: r.id,
            date: r.date,
            title: r.title ?? null,
            release: r.release
              ? {
                  slug: r.release.slug ?? null,
                  title: r.release.title ?? null,
                  cover_url: r.release.cover_url ?? null,
                }
              : null,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (!rows.length) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">Upcoming Albums</h2>
        <Link href="/calendar" className="text-sm opacity-80 hover:opacity-100 underline">
          View calendar
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {rows.map((e) => {
          const cover = e.release?.cover_url || '/placeholder/cover1.jpg';
          const title = e.release?.title || e.title || 'TBA';
          const href = e.release?.slug ? `/release/${e.release.slug}` : '/calendar';

          return (
            <Link
              key={e.id}
              href={href}
              className="group block rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600"
              title={title}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt={title} className="w-full aspect-square object-cover" />
              <div className="p-2">
                <div className="font-semibold leading-tight group-hover:underline line-clamp-1">
                  {title}
                </div>
                <div className="text-xs opacity-70">
                  {new Date(e.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
