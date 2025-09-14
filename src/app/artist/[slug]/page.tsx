// src/app/artist/[slug]/page.tsx  (SERVER)
import type { Metadata } from 'next';
import PageClient from './PageClient';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchArtist(slug: string) {
  const url = new URL(`${SUPA_URL}/rest/v1/artists`);
  url.searchParams.set('slug', `eq.${slug}`);
  url.searchParams.set('select', 'name,bio,card_img_url');
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
  const a = await fetchArtist(params.slug);
  if (!a) return { title: 'Artist | How Many Mics' };
  return {
    title: `${a.name} | How Many Mics`,
    description: a.bio ?? undefined,
    openGraph: {
      title: a.name,
      description: a.bio ?? undefined,
      images: a.card_img_url ? [{ url: a.card_img_url }] : undefined,
      type: 'profile',
    },
    twitter: {
      card: a.card_img_url ? 'summary_large_image' : 'summary',
      title: a.name,
      description: a.bio ?? undefined,
      images: a.card_img_url ? [a.card_img_url] : undefined,
    },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  return <PageClient slug={params.slug} />;
}
