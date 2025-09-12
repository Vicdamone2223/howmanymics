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

// ---- Row types for Supabase responses (to avoid `any`) ----
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
  artists: { name: string }[] | null;
  release_ratings: { rating: number }[] | null;
};

type TodayRow = {
  type: TodayEvent['type'];
  text: string;
  href: string | null;
};

type DebateRow = {
  id: number;                // ⟵ add id so we can count votes
  slug: string;
  title: string;             // (your table uses title here)
  a_label: string | null;
  b_label: string | null;
  a_pct: number | null;      // admin fallback
  b_pct: number | null;      // admin fallback
  href: string | null;
  is_featured: boolean | null;
  updated_at: string | null;
};

export default function Home() {
  const year = useMemo(() => new Date().getFullYear(), []);

  // Start with null to avoid placeholder flash
  const [news, setNews] = useState<NewsItem[] | null>(null);

  const [topYear, setTopYear] = useState<AlbumYearRow[]>([]);
  const [today, setToday] = useState<TodayEvent[]>([]);

  // Debate now uses `slug` (no href needed on state)
  const [debate, setDebate] = useState<Debate>({
    slug: '',
    topic: '—',
    aLabel: 'A',
    bLabel: 'B',
    aPct: 0,
    bPct: 0,
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
        setNews([]); // show “No posts yet.” instead of placeholders
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
          const ratings = Array.isArray(r.release_ratings) ? r.release_ratings : [];
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

      // ------- Debate Spotlight (latest featured, else latest updated) ------- //
      {
        // include id so we can count live votes
        const { data } = await supabase
          .from('debates')
          .select(
            'id,slug,title,a_label,b_label,a_pct,b_pct,href,is_featured,updated_at'
          )
          .order('is_featured', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1);

        const rows = (data ?? []) as DebateRow[];
        if (rows.length) {
          const d = rows[0];

          // live counts (parallel)
          const [aRes, bRes] = await Promise.all([
            supabase
              .from('debate_votes')
              .select('*', { head: true, count: 'exact' })
              .eq('debate_id', d.id)
              .eq('choice', 'A'),
            supabase
              .from('debate_votes')
              .select('*', { head: true, count: 'exact' })
              .eq('debate_id', d.id)
              .eq('choice', 'B'),
          ]);

          const aCount = aRes.count ?? 0;
          const bCount = bRes.count ?? 0;
          const total = aCount + bCount;

          const aPct =
            total > 0 ? Math.round((aCount * 100) / total) : Number(d.a_pct ?? 0);
          const bPct =
            total > 0 ? 100 - aPct : Number(d.b_pct ?? 0);

          setDebate({
            slug: d.slug,
            topic: d.title,
            aLabel: d.a_label ?? 'A',
            bLabel: d.b_label ?? 'B',
            aPct,
            bPct,
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

      {/* NEW: Verse of the Month (pulls latest from Supabase) */}
      <VerseOfMonth />
    </main>
  );
}
