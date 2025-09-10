'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type NewsItem = {
  id: string;
  title: string;
  dek?: string;
  heroImg: string;
  href: string;
};

export default function NewsSlider({ items = [] as NewsItem[] }) {
  // cap to 5 in case parent passes more
  const slides = items.slice(0, 5);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const t = setTimeout(updateEdges, 0);
    return () => clearTimeout(t);
  }, [slides.length]);

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
    const amount = Math.max(360, Math.floor(el.clientWidth * 0.9)) * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }

  // autoplay every 5s
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => scrollByPage(1), 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return <div className="opacity-70 text-sm">No featured posts yet.</div>;

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Featured</h2>
        <Link className="text-sm opacity-80 hover:opacity-100 underline" href="/articles">
          View all
        </Link>
      </div>

      <div className="relative">
        {/* left arrow */}
        <button
          type="button"
          aria-label="Previous"
          onClick={() => scrollByPage(-1)}
          disabled={atStart}
          className={`absolute left-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/70 backdrop-blur grid place-items-center hover:bg-zinc-900/70 disabled:opacity-40`}
        >
          ‹
        </button>

        {/* right arrow */}
        <button
          type="button"
          aria-label="Next"
          onClick={() => scrollByPage(1)}
          disabled={atEnd}
          className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/70 backdrop-blur grid place-items-center hover:bg-zinc-900/70 disabled:opacity-40`}
        >
          ›
        </button>

        {/* gradient masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-zinc-950 to-transparent rounded-l-xl" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-950 to-transparent rounded-r-xl" />

        {/* track */}
        <div
          ref={trackRef}
          onScroll={updateEdges}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-3 px-1 pb-1 [scrollbar-color:transparent_transparent] [scrollbar-width:none]"
          style={{ scrollbarWidth: 'none' }}
        >
          {slides.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="group snap-start shrink-0 w-[92%] sm:w-[70%] lg:w-[60%] xl:w-[50%] rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 bg-zinc-950"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.heroImg || '/placeholder/hero.jpg'}
                alt={a.title}
                className="w-full object-cover h-[280px] sm:h-[340px] md:h-[420px]"
              />
              <div className="p-3">
                <div className="font-semibold text-lg leading-tight group-hover:underline line-clamp-2">
                  {a.title}
                </div>
                {a.dek && <p className="text-sm mt-1 opacity-80 line-clamp-2">{a.dek}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
