// src/app/reviews/page.tsx  (SERVER)
import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Reviews | How Many Mics',
  description: 'Latest staff reviews and coverage of hip-hop albums.',
  openGraph: {
    title: 'Reviews | How Many Mics',
    description: 'Latest staff reviews and coverage of hip-hop albums.',
  },
  twitter: {
    card: 'summary',
    title: 'Reviews | How Many Mics',
    description: 'Latest staff reviews and coverage of hip-hop albums.',
  },
};

export default function Page() {
  return <PageClient />;
}
