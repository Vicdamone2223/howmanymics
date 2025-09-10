import { ListCard } from '@/types/hmm';
import { Section } from './ui/Section';

export default function ListsRail({ items }:{ items: ListCard[] }){
  if(!items?.length) return null;
  return (
    <Section title="Lists & Features" actionHref="/lists" actionLabel="Browse all">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((l,i)=> (
          <a key={i} href={l.href} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-900/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.collageImg} alt="" className="h-12 w-12 rounded object-cover border border-zinc-800"/>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide opacity-70">{l.type==='staff'?'Staff List':'Fan List'}</div>
              <div className="font-semibold line-clamp-1">{l.title}</div>
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}
