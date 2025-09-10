'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Card = { id:number|string; title:string; slug:string; cover_url:string|null; year:number|null };

export default function SimilarAlbums({ releaseId }: { releaseId: number | string }) {
  const [rows, setRows] = useState<Card[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('release_similars')
        .select(`
          position,
          r:similar_release_id ( id, title, slug, cover_url, year )
        `)
        .eq('release_id', releaseId)
        .order('position', { ascending: true });

      if (!error && data) {
        setRows((data || []).map((x: any) => x.r).filter(Boolean));
      }
    })();
  }, [releaseId]);

  if (!rows.length) return <p className="opacity-70 text-sm">No similar albums yet.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {rows.map((r) => (
        <Link
          key={String(r.id)}
          href={`/release/${r.slug}`}
          className="group block rounded-lg border border-zinc-800 hover:border-zinc-600 overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.cover_url || '/placeholder/cover1.jpg'}
            alt={r.title}
            className="w-full aspect-square object-cover"
          />
          <div className="p-2">
            <div className="font-semibold leading-tight group-hover:underline line-clamp-1">
              {r.title}
            </div>
            <div className="text-xs opacity-70">{r.year ?? '—'}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
