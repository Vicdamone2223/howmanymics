import { TrendingRow } from '@/types/hmm';
import { Section } from './ui/Section';

export default function TrendingRail({ items }:{ items: TrendingRow[] }){
  if(!items?.length) return null;
  return (
    <Section title="Trending Now" actionHref="/trending" actionLabel="View more">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((t,i)=> (
          <a key={i} href={t.href} className="min-w-[180px] p-3 rounded-lg border border-zinc-800 hover:bg-zinc-900/60">
            <div className="font-semibold line-clamp-1">{t.title}</div>
            <div className="text-xs opacity-70 line-clamp-1 mb-2">{t.artist}</div>
            <div className="text-xs">+{t.votesDelta} votes</div>
            <div className="text-sm font-bold tabular-nums">{Math.round(t.scoreNow)}</div>
          </a>
        ))}
      </div>
    </Section>
  );
}
