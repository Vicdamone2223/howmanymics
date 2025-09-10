// src/app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

import NewsSlider from '@/components/NewsSlider';
import UpcomingReleasesRail from '@/components/UpcomingReleasesRail';
import GoatTicker from '@/components/GoatTicker';
import TopOfYear from '@/components/TopOfYear';
import TodayInHipHopWidget from '@/components/TodayInHipHopWidget';
import DebateSpotlight from '@/components/DebateSpotlight';
import ListsRail from '@/components/ListsRail';

import type { AlbumYearRow, Debate, ListCard, NewsItem, TodayEvent } from '@/types/hmm';

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

export default function Home() {
  const year = useMemo(() => new Date().getFullYear(), []);

  // Start with null to avoid placeholder flash
  const [news, setNews] = useState<NewsItem[] | null>(null);

  const [topYear, setTopYear] = useState<AlbumYearRow[]>([]);
  const [today, setToday] = useState<TodayEvent[]>([]);
  const [debate, setDebate] = useState<Debate>({
    topic: '—',
    aLabel: 'A',
    bLabel: 'B',
    aPct: 0,
    bPct: 0,
    href: '#',
  });
  const [lists] = useState<ListCard[]>([
    { type: 'staff', title: '5 Albums That Changed the South', collageImg: '/placeholder/list1.jpg', href: '/list/south-changed' },
    { type: 'fan', title: 'Top 10 NY Albums', collageImg: '/placeholder/list2.jpg', href: '/list/top-ny' },
  ]);

  useEffect(() => {
    (async () => {
      // ------- Featured slider: latest 5 with published_at (articles + reviews) -------
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('id,title,slug,cover_url,excerpt,dek,kind,published_at')
          .not('published_at', 'is', null)
          .in('kind', ['article', 'review'])
          .order('published_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        const items: NewsItem[] = (data || []).map((a: any) => ({
          id: String(a.id),
          title: a.title,
          dek: a.dek ?? a.excerpt ?? '',
          tag: a.kind === 'review' ? 'REVIEW' : 'ARTICLE',
          heroImg: a.cover_url || '/placeholder/hero1.jpg',
          href: `/articles/${a.slug}`,
        }));

        setNews(items);
      } catch (e) {
        console.error('articles fetch error:', e);
        setNews([]); // show “No posts yet.” instead of placeholders
      }

      // ------- Top albums of the year (overall = 50% staff + 50% people) -------
      {
        const { data } = await supabase
          .from('releases')
          .select('id,title,slug,cover_url,year,rating_staff,artists!inner(name),release_ratings(rating)')
          .eq('year', year);

        const rows = (data || []).map((r: any) => {
          const ratings = Array.isArray(r.release_ratings) ? r.release_ratings : [];
          const pplNums = ratings.map((x: any) => Number(x.rating)).filter(Number.isFinite);
          const peopleAvg = pplNums.length ? pplNums.reduce((s, n) => s + n, 0) / pplNums.length : null;

          const staff = r.rating_staff ?? null;
          const overall =
            staff == null && peopleAvg == null
              ? null
              : staff != null && peopleAvg == null
              ? staff
              : staff == null && peopleAvg != null
              ? Math.round(peopleAvg)
              : Math.round(0.5 * Number(staff) + 0.5 * Number(peopleAvg));

          return {
            rank: 0,
            cover: r.cover_url || '/placeholder/cover1.jpg',
            title: r.title,
            artist: r.artists?.name ?? 'Various',
            scoreOverall: overall ?? 0,
            date: String(r.year ?? ''),
            href: `/release/${r.slug}`,
          } as AlbumYearRow;
        });

        rows
          .sort((a, b) => (b.scoreOverall || 0) - (a.scoreOverall || 0))
          .slice(0, 4)
          .forEach((row, i) => (row.rank = i + 1));

        if (rows.length) setTopYear(rows.slice(0, 4));
      }

      // ------- Upcoming rail uses its own component fetch (calendar_events) -------

      // ------- Today in Hip-Hop -------
      {
        const d = new Date();
        const mm = d.getMonth() + 1;
        const dd = d.getDate();
        const { data } = await supabase
          .from('today_in_hiphop')
          .select('type,text,href')
          .eq('month', mm)
          .eq('day', dd)
          .limit(10);

        const items = (data || []).map((t: any) => ({
          type: t.type as TodayEvent['type'],
          text: t.text,
          href: t.href || '#',
        })) as TodayEvent[];

        if (items.length) setToday(items);
      }

      // ------- Debate Spotlight (latest featured, else latest updated) -------
      {
        const { data } = await supabase
          .from('debates')
          .select('title,a_label,b_label,a_pct,b_pct,href,is_featured,updated_at')
          .order('is_featured', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1);

        if (data && data.length) {
          const d = data[0] as any;
          setDebate({
            topic: d.title,
            aLabel: d.a_label ?? 'A',
            bLabel: d.b_label ?? 'B',
            aPct: Number(d.a_pct ?? 0),
            bPct: Number(d.b_pct ?? 0),
            href: d.href || '#',
          });
        }
      }
    })();
  }, [year]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-4">
      {/* Only render when real data arrives (prevents placeholder flash) */}
      {news !== null && <NewsSlider items={news} autoPlayMs={5000} />}

      <GoatTicker limit={15} />
      <TopOfYear items={topYear} year={year} />
      {/* Upcoming rail self-fetches from calendar_events */}
      <UpcomingReleasesRail />
      <TodayInHipHopWidget items={today} />
      <DebateSpotlight debate={debate} />
      <ListsRail items={[]} />
    </main>
  );
}
