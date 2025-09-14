// src/app/articles/[slug]/page.tsx  (SERVER)
import type { Metadata } from 'next';
import PageClient from './PageClient';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchArticle(slug: string) {
  // Use the PostgREST endpoint directly for a tiny server fetch (no client SDK needed)
  const url = new URL(`${SUPA_URL}/rest/v1/articles`);
  url.searchParams.set('slug', `eq.${slug}`);
  url.searchParams.set('select', 'title,dek,cover_url,author,published_at,kind');
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
    },
    // Ensure this can be cached/revalidated if you want later:
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as any[];
  return rows[0] ?? null;
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const row = await fetchArticle(params.slug);
  if (!row) {
    return {
      title: 'Article | How Many Mics',
      description: 'Hip-hop articles and reviews.',
    };
  }
  return {
    title: `${row.title} | How Many Mics`,
    description: row.dek ?? undefined,
    openGraph: {
      title: row.title,
      description: row.dek ?? undefined,
      images: row.cover_url ? [{ url: row.cover_url }] : undefined,
      type: 'article',
    },
    twitter: {
      card: row.cover_url ? 'summary_large_image' : 'summary',
      title: row.title,
      description: row.dek ?? undefined,
      images: row.cover_url ? [row.cover_url] : undefined,
    },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  return <PageClient slug={params.slug} />;
}
