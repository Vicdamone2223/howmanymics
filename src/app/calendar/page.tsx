// src/app/calendar/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type EventRow = {
  id: number | string;
  title: string;
  date: string; // YYYY-MM-DD
  status: 'confirmed' | 'likely' | 'tentative' | string | null;
  release_id: number | string | null;
  release_slug?: string | null;
  cover_url?: string | null;
};

type DayCell = { y: number; m: number; d: number; iso: string };

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

function monthRange(year: number, month1to12: number) {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const end = new Date(Date.UTC(year, month1to12, 0));
  const startISO = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`;
  const endISO = `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`;
  return { startISO, endISO };
}

function buildGrid(year: number, month1to12: number): DayCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month1to12 - 1, 1));
  const sundayIdx = firstOfMonth.getUTCDay(); // 0=Sun..6=Sat
  const backfill = sundayIdx;

  const daysInMonth = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();

  // previous month
  const prev = new Date(Date.UTC(year, month1to12 - 1, 0));
  const prevDays = prev.getUTCDate();

  const cells: DayCell[] = [];
  for (let i = backfill - 1; i >= 0; i--) {
    const d = prevDays - i;
    const y = prev.getUTCFullYear();
    const m = prev.getUTCMonth() + 1;
    cells.push({ y, m, d, iso: `${y}-${pad(m)}-${pad(d)}` });
  }
  // current
  for (let d = 1; d <= daysInMonth; d++) {
    const y = year;
    const m = month1to12;
    cells.push({ y, m, d, iso: `${y}-${pad(m)}-${pad(d)}` });
  }
  // next
  const needed = 42 - cells.length;
  const next = new Date(Date.UTC(year, month1to12, 1));
  for (let d = 1; d <= needed; d++) {
    const y = next.getUTCFullYear();
    const m = next.getUTCMonth() + 1;
    cells.push({ y, m, d, iso: `${y}-${pad(m)}-${pad(d)}` });
  }
  return cells;
}

export default function CalendarGridPage() {
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const [rows, setRows] = useState<
    (EventRow & { cover: string | null; slug: string | null })[]
  >([]);
  const [loading, setLoading] = useState(true);

  const grid = useMemo(() => buildGrid(ym.y, ym.m), [ym]);
  const monthLabel = useMemo(
    () =>
      new Date(ym.y, ym.m - 1, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [ym]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { startISO, endISO } = monthRange(ym.y, ym.m);

      // 1) Fetch events for the month
      const { data: evs, error } = await supabase
        .from('calendar_events')
        .select('id,title,date,status,release_id,release_slug,cover_url')
        .gte('date', startISO)
        .lte('date', endISO)
        .order('date', { ascending: true });

      if (error) {
        console.error('calendar fetch error:', error);
        setRows([]);
        setLoading(false);
        return;
      }

      const events: EventRow[] = (evs || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: String(e.date).slice(0, 10),
        status: e.status ?? null,
        release_id: e.release_id ?? null,
        release_slug: e.release_slug ?? null,
        cover_url: e.cover_url ?? null,
      }));

      // 2) Look up slug + cover from releases for any linked release_id
      const idsNum = Array.from(
        new Set(
          events
            .map((e) => (e.release_id == null ? null : Number(e.release_id)))
            .filter((n): n is number => Number.isFinite(n))
        )
      );

      let coverById = new Map<number, string | null>();
      let slugById = new Map<number, string | null>();

      if (idsNum.length) {
        const { data: rels, error: relErr } = await supabase
          .from('releases')
          .select('id,slug,cover_url')
          .in('id', idsNum);

        if (relErr) console.error('releases lookup error:', relErr);

        (rels || []).forEach((r: any) => {
          coverById.set(Number(r.id), r.cover_url || null);
          slugById.set(Number(r.id), r.slug || null);
        });
      }

      const merged = events.map((e) => {
        const rid = e.release_id == null ? null : Number(e.release_id);
        const slug = e.release_slug || (rid != null ? slugById.get(rid) || null : null);
        const cover =
          e.cover_url || (rid != null ? coverById.get(rid) || null : null) || '/placeholder/cover1.jpg';
        return { ...e, slug, cover };
      });

      setRows(merged);
      setLoading(false);
    })();
  }, [ym]);

  const eventsByIso = useMemo(() => {
    const m = new Map<string, (EventRow & { cover: string | null; slug: string | null })[]>();
    rows.forEach((r) => {
      const iso = r.date.slice(0, 10);
      const list = m.get(iso) || [];
      list.push(r);
      m.set(iso, list);
    });
    return m;
  }, [rows]);

  function prevMonth() {
    setYm((p) => {
      const d = new Date(p.y, p.m - 2, 1);
      return { y: d.getFullYear(), m: d.getMonth() + 1 };
    });
  }
  function nextMonth() {
    setYm((p) => {
      const d = new Date(p.y, p.m, 1);
      return { y: d.getFullYear(), m: d.getMonth() + 1 };
    });
  }
  function goToday() {
    const d = new Date();
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-extrabold">{monthLabel}</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900">
            ← Prev
          </button>
          <button onClick={goToday} className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900">
            Today
          </button>
          <button onClick={nextMonth} className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900">
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-xs uppercase opacity-60 px-2 py-1">
            {d}
          </div>
        ))}

        {grid.map((cell, idx) => {
          const inMonth = cell.m === ym.m;
          const dayEvents = eventsByIso.get(cell.iso) || [];
          return (
            <div
              key={`${cell.iso}-${idx}`}
              className={`min-h-[110px] rounded-lg border ${
                inMonth ? 'border-zinc-800' : 'border-zinc-900 bg-zinc-950/40'
              } p-2`}
            >
              <div className={`text-xs mb-1 ${inMonth ? 'opacity-80' : 'opacity-40'}`}>{cell.d}</div>

              <div className="flex flex-col gap-2">
                {dayEvents.map((ev) => {
                  const href = ev.slug ? `/release/${ev.slug}` : null;
                  const content = (
                    <div className="flex items-center gap-2 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ev.cover || '/placeholder/cover1.jpg'}
                        alt={ev.title}
                        className="h-7 w-7 rounded border border-zinc-800 object-cover"
                      />
                      <div className="text-xs truncate group-hover:underline">{ev.title}</div>
                    </div>
                  );
                  return href ? (
                    <Link key={String(ev.id)} href={href}>
                      {content}
                    </Link>
                  ) : (
                    <div key={String(ev.id)}>{content}</div>
                  );
                })}
                {loading && dayEvents.length === 0 && <div className="text-xs opacity-40"> </div>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
