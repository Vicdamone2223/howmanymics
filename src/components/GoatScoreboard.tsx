import { GoatRow } from '@/types/hmm';
import { Section } from './ui/Section';

export default function GoatScoreboard({ rows }:{ rows: GoatRow[] }){
  if(!rows?.length) return null;
  return (
    <Section title="Overall GOAT Rankings" actionHref="/rankings" actionLabel="See full rankings">
      <ol className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
        {rows.map((r)=> (
          <li key={r.rank} className="flex items-center gap-3 p-3 hover:bg-zinc-900/60">
            <div className="w-6 text-right tabular-nums text-orange-500 font-bold">{r.rank}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.img} alt="" className="h-10 w-10 rounded-md object-cover border border-zinc-800"/>
            <div className="flex-1">
              <div className="font-semibold leading-5">{r.name}</div>
            </div>
            {typeof r.rankStaff==='number' && (
              Math.abs((r.rankStaff ?? 0) - r.rank) >= 3 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 mr-2">
                  ⚡ staff disagrees
                </span>
              )
            )}
            <div className="text-sm font-bold tabular-nums">{Math.round(r.scoreOverall)}</div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
