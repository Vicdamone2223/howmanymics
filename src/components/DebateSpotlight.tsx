import { Debate } from '@/types/hmm';
import { Section } from './ui/Section';

export default function DebateSpotlight({ debate }:{ debate: Debate }){
  if(!debate) return null;
  return (
    <Section title="Debate Spotlight" actionHref="/debates" actionLabel="More debates">
      <div className="p-4 rounded-xl border border-zinc-800">
        <div className="font-semibold mb-3">{debate.topic}</div>
        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-lg border border-zinc-700 p-3 hover:bg-zinc-900/60">
            {debate.aLabel}
            <div className="text-xs opacity-70">{Math.round(debate.aPct)}%</div>
          </button>
          <button className="rounded-lg border border-zinc-700 p-3 hover:bg-zinc-900/60">
            {debate.bLabel}
            <div className="text-xs opacity-70">{Math.round(debate.bPct)}%</div>
          </button>
        </div>
      </div>
    </Section>
  );
}
