'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id:number; slug:string; topic:string;
  a_label:string; b_label:string; a_pct:number; b_pct:number;
  published_at:string|null;
};

export default function DebatesPage(){
  const [rows,setRows]=useState<Row[]>([]);
  useEffect(()=>{(async()=>{
    const { data } = await supabase
      .from('debates')
      .select('id,slug,topic,a_label,b_label,a_pct,b_pct,published_at')
      .not('published_at','is',null)
      .order('published_at',{ascending:false});
    setRows((data||[]) as Row[]);
  })();},[]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-4">Debates</h1>
      {rows.length===0 ? (
        <div className="opacity-70 text-sm">No debates yet.</div>
      ):(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map(r=>(
            <Link key={r.id} href={`/debates/${r.slug}`} className="rounded-lg border border-zinc-800 p-3 hover:border-zinc-600">
              <div className="text-xs uppercase opacity-60 mb-1">Debate</div>
              <div className="font-semibold leading-snug">{r.topic}</div>
              <div className="text-xs opacity-75 mt-1">
                {r.a_label}: {r.a_pct}% • {r.b_label}: {r.b_pct}%
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
