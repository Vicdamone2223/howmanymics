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
import VerseOfMonth from '@/components/VerseOfMonth';

import type {
  AlbumYearRow,
  Debate,
  ListCard,
  NewsItem,
  TodayEvent,
} from '@/types/hmm';

// ---- Row types for Supabase responses ----
type ArticleRow = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  dek: string | null;
  kind: 'article' | 'review';
  published_at: string | null;
};

type ReleaseRow = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  year: number | null;
  rating_staff: number | null;
  artists: { name: string }[] | null;              // via join
  release_ratings: { rating: number }[] | null;    // via join
};

type TodayRow = {
  type: TodayEvent['type'];
  text: string;
  href: string | null;
};

type DebateRow = {
  id: number;
  slug: string;
  topic: string;
  a_label: string | null;
  b_label: string | null;
  a_pct: number | null; // legacy default / fallback
  b_pct: number | null; // legacy default / fallback
  is_featured: boolean | null;
  updated_at: string | null;
};

export default function Home() {
  const year = useMemo(() => new Date().getFullYear(), []);

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
    {
      type: 'staff',
      title: '5 Albums That Changed the South',
      collageImg: '/placeholder/list1.jpg',
      href: '/list/south-changed',
    },
    {
      type: 'fan',
      title: 'Top 10 NY Albums',
      collageImg: '/placeholder/list2.jpg',
      href: '/list/top-ny',
    },
  ]);

  useEffect(() => {
    (async () => {
      // ------- Featured slider -------
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('id,title,slug,cover_url,excerpt,dek,kind,published_at')
          .not('published_at', 'is', null)
          .in('kind', ['article', 'review'])
          .order('published_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        const rows = (data ?? []) as ArticleRow[];
        const items: NewsItem[] = rows.map((a) => ({
          id: String(a.id),
          title: a.title,
          dek: a.dek ?? a.excerpt ?? '',
          tag: (a.kind === 'review' ? 'REVIEW' : 'ARTICLE') as NewsItem['tag'],
          heroImg: a.cover_url || '/placeholder/hero1.jpg',
          href: `/articles/${a.slug}`,
        }));

        setNews(items);
      } catch (e) {
        console.error('articles fetch error:', e);
        setNews([]); // show “No posts yet.”
      }

      // ------- Top albums of the year -------
      {
        const { data } = await supabase
          .from('releases')
          .select(
            'id,title,slug,cover_url,year,rating_staff,artists!inner(name),release_ratings(rating)'
          )
          .eq('year', year);

        const rows = (data ?? []) as ReleaseRow[];

        const formatted: AlbumYearRow[] = rows.map((r) => {
          const ratings = Array.isArray(r.release_ratings)
            ? r.release_ratings
            : [];
          const pplNums: number[] = ratings
            .map((x) => Number(x.rating))
            .filter((v): v is number => Number.isFinite(v));
          const peopleAvg =
            pplNums.length > 0
              ? pplNums.reduce((sum: number, n: number) => sum + n, 0) / pplNums.length
              : null;

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
            artist: r.artists?.[0]?.name ?? 'Various',
            scoreOverall: overall ?? 0,
            date: String(r.year ?? ''),
            href: `/release/${r.slug}`,
          };
        });

        formatted
          .sort((a, b) => (b.scoreOverall || 0) - (a.scoreOverall || 0))
          .slice(0, 4)
          .forEach((row, i) => (row.rank = i + 1));

        if (formatted.length) setTopYear(formatted.slice(0, 4));
      }

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

        const rows = (data ?? []) as TodayRow[];
        const items: TodayEvent[] = rows.map((t) => ({
          type: t.type,
          text: t.text,
          href: t.href || '#',
        }));

        if (items.length) setToday(items);
      }

      // ------- Debate Spotlight (compute live from votes; fallback to stored %) -------
      {
        const { data } = await supabase
          .from('debates')
          .select('id,slug,topic,a_label,b_label,a_pct,b_pct,is_featured,updated_at')
          .order('is_featured', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1);

        const rows = (data ?? []) as DebateRow[];
        if (rows.length) {
          const d = rows[0];

          // Try to compute live counts from debate_votes
          let aCount = 0;
          let bCount = 0;

          try {
            const aRes = await supabase
              .from('debate_votes')
              .select('*', { count: 'exact', head: true })
              .eq('debate_id', d.id)
              .eq('choice', 'A');
            aCount = aRes.count ?? 0;

            const bRes = await supabase
              .from('debate_votes')
              .select('*', { count: 'exact', head: true })
              .eq('debate_id', d.id)
              .eq('choice', 'B');
            bCount = bRes.count ?? 0;
          } catch {
            // ignore; will use fallback below
          }

          const total = aCount + bCount;

          const aPctLive =
            total > 0 ? Math.round((aCount / total) * 100) : null;
          const bPctLive =
            total > 0 ? Math.max(0, 100 - (aPctLive ?? 0)) : null;

          setDebate({
            topic: d.topic,
            aLabel: d.a_label ?? 'A',
            bLabel: d.b_label ?? 'B',
            aPct:
              aPctLive ?? (typeof d.a_pct === 'number' ? d.a_pct : 50),
            bPct:
              bPctLive ?? (typeof d.b_pct === 'number' ? d.b_pct : 50),
            // Link to the debate detail (so users can vote there too)
            href: `/debates/${d.slug}`,
          });
        }
      }
    })();
  }, [year]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-4">
      {/* Only render when real data arrives (prevents placeholder flash) */}
      {news !== null && <NewsSlider items={news as NewsItem[]} />}

      <GoatTicker limit={15} />
      <TopOfYear items={topYear} year={year} />

      {/* Upcoming rail self-fetches from calendar_events */}
      <UpcomingReleasesRail />

      <TodayInHipHopWidget items={today} />
      <DebateSpotlight debate={debate} />
      <ListsRail items={[]} />

      {/* Verse of the Month */}
      <VerseOfMonth />
    </main>
  );
}
