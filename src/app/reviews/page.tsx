import type { Metadata } from 'next';
import PageClient from './PageClient';
import { buildMetadata } from '@/lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.howmanymics.com';

export const metadata: Metadata = buildMetadata({
  baseTitle: 'Reviews | How Many Mics',
  baseDescription: 'All album reviews from How Many Mics.',
  canonical: `${SITE_URL}/reviews`,
  ogImage: null,
});

export default function Page() {
  return <PageClient />;
}
