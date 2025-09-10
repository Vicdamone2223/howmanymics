import { TodayEvent } from '@/types/hmm';
import { Section } from './ui/Section';

export default function TodayInHipHopWidget({ items }:{ items: TodayEvent[] }){
  if(!items?.length) return null;
  return (
    <Section title="Today in Hip-Hop" actionHref="/today" actionLabel="Full timeline">
      <ul className="space-y-2">
        {items.map((e,i)=> (
          <li key={i} className="text-sm">
            <a href={e.href} className="hover:underline">
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
