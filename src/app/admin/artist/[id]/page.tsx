import type { Metadata } from 'next';
import PageClient from './PageClient';

export const metadata: Metadata = {
  title: 'Edit Artist | Admin',
  description: 'Update artist details, SEO, and long-form bio.',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params; // Next 15 typing requires await
  return <PageClient />;
}
