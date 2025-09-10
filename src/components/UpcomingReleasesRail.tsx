// src/components/UpcomingReleasesRail.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ReleaseItem = {
  id: string;
  cover: string;
  title: string;
  artist?: string;
  date: string;  // e.g. "Sep 12"
  href: string;  // /release/slug or '#'
};

function yyyymmddLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}
/** Parse a DATE string ("YYYY-MM-DD") as LOCAL to avoid UTC off-by-one. */
function parseDateOnlyLocal(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export default function UpcomingReleasesRail() {
  const [items, setItems] = useState<ReleaseItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // simple scroll helpers
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  function updateEdges() {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAtStart(scrollLeft <= 2);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 2);
  }
  function scrollByPage(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.9)) * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }

  useEffect(() => {
    (async () => {
      setErr(null);
      const start = yyyymmddLocal(new Date());
      const end = yyyymmddLocal(addMonths(new Date(), 6));

      try {
        // 1) events in range
        const { data: ev, error } = await supabase
          .from('calendar_events')
          .select('id,date,title,release_id,release_slug')
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true })
          .limit(50);
        if (error) throw error;

        const events = (ev || []) as Array<{
          id: number;
          date: string;
          title: string | null;
          release_id: number | null;
          release_slug: string | null;
        }>;

        // 2) collect identifiers
        const idSet = new Set<number>();
        const slugSet = new Set<string>();
        for (const e of events) {
          if (e.release_id) idSet.add(Number(e.release_id));
          else if (e.release_slug) slugSet.add(e.release_slug);
        }

        // 3) fetch releases by id
        const idList = Array.from(idSet);
        const slugList = Array.from(slugSet);

        const relById = new Map<number, any>();
        const relBySlug = new Map<string, any>();

        if (idList.length) {
          const { data: relsById } = await supabase
            .from('releases')
            .select('id,slug,title,cover_url,artist_id')
            .in('id', idList);
          (relsById || []).forEach((r: any) => relById.set(Number(r.id), r));
        }

        // 4) fetch releases by slug where we didn’t have an id
        if (slugList.length) {
          const { data: relsBySlug } = await supabase
            .from('releases')
            .select('id,slug,title,cover_url,artist_id')
            .in('slug', slugList);
          (relsBySlug || []).forEach((r: any) => relBySlug.set(String(r.slug), r));
        }

        // 5) fetch artist names for those releases (avoid ambiguous joins)
        const artistIdSet = new Set<number>();
        for (const r of relById.values()) if (r.artist_id) artistIdSet.add(Number(r.artist_id));
        for (const r of relBySlug.values()) if (r.artist_id) artistIdSet.add(Number(r.artist_id));
        const artistMap = new Map<number, string>();
        if (artistIdSet.size) {
          const { data: arts } = await supabase
            .from('artists')
            .select('id,name')
            .in('id', Array.from(artistIdSet));
          (arts || []).forEach((a: any) => artistMap.set(Number(a.id), a.name as string));
        }

        // 6) build cards — use release by id, else by slug; show real covers
        const cards: ReleaseItem[] = events.map((e) => {
          const rel = e.release_id
            ? relById.get(Number(e.release_id))
            : (e.release_slug ? relBySlug.get(e.release_slug) : null);

          const dt = parseDateOnlyLocal(e.date);
          const label = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

          const cover = rel?.cover_url || '/placeholder/cover2.jpg';
          const title = e.title || rel?.title || 'TBA';
          const artist = rel?.artist_id ? artistMap.get(Number(rel.artist_id)) : undefined;
          const slug = e.release_slug || rel?.slug || null;

          return {
            id: String(e.id),
            cover,
            title,
            artist,
            date: label,
            href: slug ? `/release/${slug}` : '#',
          };
        });

        setItems(cards);
        setTimeout(updateEdges, 0);
      } catch (e: any) {
        console.error('UpcomingReleasesRail fetch error:', e?.message || e);
        setErr('Could not load upcoming releases.');
        setItems([]);
      }
    })();
  }, []);

  if (err) {
    return (
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Upcoming Albums</h2>
          <Link href="/calendar" className="text-sm opacity-80 hover:opacity-100 underline">
            View calendar →
          </Link>
        </div>
        <div className="text-sm opacity-70">{err}</div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Upcoming Albums</h2>
          <Link href="/calendar" className="text-sm opacity-80 hover:opacity-100 underline">
            View calendar →
          </Link>
        </div>
        <div className="text-sm opacity-70">No upcoming albums scheduled. Add some in the calendar →</div>
      </section>
    );
  }

  return (
    <section className="mt-8 relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Upcoming Albums</h2>
        <Link href="/calendar" className="text-sm opacity-80 hover:opacity-100 underline">
          View calendar →
        </Link>
      </div>

      {/* arrows */}
      <button
        type="button"
        aria-label="Previous"
        onClick={() => scrollByPage(-1)}
        disabled={atStart}
        className="absolute -left-2 top-[52%] -translate-y-1/2 z-10 h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/70 backdrop-blur grid place-items-center hover:bg-zinc-900/70 disabled:opacity-40"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByPage(1)}
        disabled={atEnd}
        className="absolute -right-2 top-[52%] -translate-y-1/2 z-10 h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/70 backdrop-blur grid place-items-center hover:bg-zinc-900/70 disabled:opacity-40"
      >
        ›
      </button>

      {/* track */}
      <div
        ref={trackRef}
        onScroll={updateEdges}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-3 px-1 pb-1
                   [scrollbar-color:transparent_transparent] [scrollbar-width:none]"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className="group snap-start shrink-0 w-[75%] sm:w-[45%] lg:w-[30%] xl:w-[24%]
                       rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 bg-zinc-950"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.cover} alt={r.title} className="w-full aspect-square object-cover" />
            <div className="p-3">
              <div className="font-semibold leading-tight group-hover:underline line-clamp-2">{r.title}</div>
              <div className="text-xs opacity-70">
                {r.artist ? <>{r.artist} • </> : null}
                {r.date}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
