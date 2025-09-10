'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = { id:number; title:string; slug:string; excerpt:string|null; published_at:string|null };

export default function AlbumReviews({ releaseId }:{ releaseId:number|string }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(()=>{(async()=>{
    const { data } = await supabase
      .from('articles')
      .select('id,title,slug,excerpt,published_at')
      .eq('kind','review')
      .eq('release_id', releaseId)
      .not('published_at','is',null)
      .order('published_at',{ascending:false});
    setRows((data||[]) as Row[]);
  })();},[releaseId]);

  if (!rows.length) return <p className="opacity-70 text-sm">No review yet.</p>;

  return (
    <div className="space-y-3">
      {rows.map(r => (
        <Link key={r.id} href={`/articles/${r.slug}`}
              className="block rounded-lg border border-zinc-800 hover:border-zinc-600 p-3">
          <div className="text-xs opacity-70 mb-1">
            {r.published_at ? new Date(r.published_at).toLocaleDateString() : null}
          </div>
          <div className="font-semibold leading-tight">{r.title}</div>
          {r.excerpt && <p className="text-sm opacity-80 mt-1 line-clamp-2">{r.excerpt}</p>}
        </Link>
      ))}
    </div>
  );
}
