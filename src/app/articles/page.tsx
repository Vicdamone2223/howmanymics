// src/app/articles/page.tsx
import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Articles | How Many Mics',
  description: 'Latest hip-hop articles, news, and editorials.',
};

export default function Page() {
  return <PageClient />;
}
