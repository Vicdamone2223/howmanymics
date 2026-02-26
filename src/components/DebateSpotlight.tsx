import Link from 'next/link';
import { Section } from './ui/Section';

type Props = {
  debate: {
    slug: string;          // MUST be present
    topic: string;
    aLabel: string;
    bLabel: string;
    aPct: number;
    bPct: number;
  } | null;
};

export default function DebateSpotlight({ debate }: Props) {
  if (!debate) return null;

  // clicking A/B sends you to the detail page which auto-casts the vote
  const hrefA = `/debates/${debate.slug}?vote=A`;
  const hrefB = `/debates/${debate.slug}?vote=B`;

  return (
    <Section title="Debate Spotlight" actionHref="/debates" actionLabel="More debates">
      <div className="p-4 rounded-xl border border-zinc-800">
        <div className="font-semibold mb-3">{debate.topic}</div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={hrefA}
            className="rounded-lg border border-zinc-700 p-3 hover:bg-zinc-900/60"
            aria-label={`Vote A: ${debate.aLabel}`}
          >
            {debate.aLabel}
            <div className="text-xs opacity-70">{Math.round(debate.aPct)}%</div>
          </Link>

          <Link
            href={hrefB}
            className="rounded-lg border border-zinc-700 p-3 hover:bg-zinc-900/60"
            aria-label={`Vote B: ${debate.bLabel}`}
          >
            {debate.bLabel}
            <div className="text-xs opacity-70">{Math.round(debate.bPct)}%</div>
          </Link>
        </div>
      </div>
    </Section>
  );
}
