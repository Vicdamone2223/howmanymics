'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type VerseRow = {
  month: string;
  artist_name: string;
  song_title: string;
  instagram_url: string;
};

export default function VerseOfMonth() {
  const [v, setV] = useState<VerseRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('verse_of_month')
        .select('month,artist_name,song_title,instagram_url')
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) setV(data as VerseRow);
    })();
  }, []);

  // Load Instagram embed script after we know we have a URL
  useEffect(() => {
    if (!v?.instagram_url) return;
    const existing = document.querySelector('script[data-ig-embed]');
    if (!existing) {
      const s = document.createElement('script');
      s.src = 'https://www.instagram.com/embed.js';
      s.async = true;
      s.defer = true;
      s.setAttribute('data-ig-embed', '1');
      document.body.appendChild(s);
    } else {
      (window as any)?.instgrm?.Embeds?.process?.();
    }
  }, [v?.instagram_url]);

  if (!v) return null;

  return (
    <section className="mt-10 rounded-xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
      <div className="px-3 py-2 text-xs uppercase tracking-wide opacity-70 border-b border-zinc-800">
        Verse of the Month — {v.month}
      </div>

      <div className="grid md:grid-cols-2 gap-0">
        <div className="p-4">
          <h3 className="text-xl font-extrabold">
            {v.artist_name}
            <span className="opacity-70 font-normal"> — {v.song_title}</span>
          </h3>
          <p className="mt-2 text-sm opacity-80">
            Hand-picked verse highlight from this month.
          </p>

          <a
            href={v.instagram_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-4 px-3 py-2 rounded-lg bg-orange-500 text-black font-bold"
          >
            Watch on Instagram →
          </a>
        </div>

        {/* Instagram embed (auto-converts by their script) */}
        <div className="p-3 border-t md:border-t-0 md:border-l border-zinc-800 bg-black">
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={v.instagram_url}
            data-instgrm-version="14"
            style={{ width: '100%', margin: 0, border: '0' }}
          />
        </div>
      </div>
    </section>
  );
}
