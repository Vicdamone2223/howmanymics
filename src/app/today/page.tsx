'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = { id:number; month:number; day:number; type:'anniv'|'birthday'|'news'; text:string; href:string|null };

export default function TodayPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async() => {
      setLoading(true);
      const { data } = await supabase
        .from('today_in_hiphop')
        .select('id,month,day,type,text,href')
        .eq('month', month)
        .eq('day', day)
        .order('id', { ascending: false });

      setRows((data||[]) as Row[]);
      setLoading(false);
    })();
  }, [month, day]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-4">Today in Hip-Hop</h1>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <input className="input" type="number" min={1} max={12} value={month} onChange={e=>setMonth(parseInt(e.target.value||'1'))} />
        <input className="input" type="number" min={1} max={31} value={day} onChange={e=>setDay(parseInt(e.target.value||'1'))} />
      </div>

      {loading ? (
        <div className="opacity-70 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="opacity-70 text-sm">No events for this date yet.</div>
      ) : (
        <ul className="grid gap-3">
          {rows.map(r => (
            <li key={r.id} className="rounded-lg border border-zinc-800 p-3">
              <div className="text-xs uppercase opacity-60 mb-1">{r.type}</div>
              <div className="text-sm">{r.text}</div>
              {r.href && <a className="text-xs underline opacity-80 hover:opacity-100" href={r.href}>Learn more</a>}
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f4f4f5;
          outline: none;
        }
      `}</style>
    </main>
  );
}
