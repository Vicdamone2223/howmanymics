// src/app/release/[slug]/page.tsx  (SERVER)
import type { Metadata } from 'next';
import PageClient from './PageClient';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchRelease(slug: string) {
  const url = new URL(`${SUPA_URL}/rest/v1/releases`);
  url.searchParams.set('slug', `eq.${slug}`);
  url.searchParams.set('select', 'title,cover_url,year');
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as any[];
  return rows[0] ?? null;
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const r = await fetchRelease(params.slug);
  if (!r) return { title: 'Album | How Many Mics' };
  const baseTitle = r.year ? `${r.title} (${r.year})` : r.title;
  return {
    title: `${baseTitle} | How Many Mics`,
    description: `Details, tracklist, ratings and more for ${baseTitle}.`,
    openGraph: {
      title: baseTitle,
      description: `Details, tracklist, ratings and more for ${baseTitle}.`,
      images: r.cover_url ? [{ url: r.cover_url }] : undefined,
      type: 'music.album',
    },
    twitter: {
      card: r.cover_url ? 'summary_large_image' : 'summary',
      title: baseTitle,
      description: `Details, tracklist, ratings and more for ${baseTitle}.`,
      images: r.cover_url ? [r.cover_url] : undefined,
    },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  return <PageClient slug={params.slug} />;
}
