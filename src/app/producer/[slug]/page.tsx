import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Producer',
  description: 'Producer page',
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; // Next 15 typed params
  return <PageClient slug={slug} />;
}
