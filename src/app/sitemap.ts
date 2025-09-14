// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/seo';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/artists`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/releases`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/articles`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/reviews`, changeFrequency: 'weekly', priority: 0.6 },
  ];

  const { data: artists } = await supa.from('artists').select('slug,updated_at').limit(5000);
  (artists ?? []).forEach((a: any) =>
    urls.push({
      url: `${SITE_URL}/artist/${a.slug}`,
      lastModified: a.updated_at ?? undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    })
  );

  const { data: releases } = await supa.from('releases').select('slug,updated_at').limit(5000);
  (releases ?? []).forEach((r: any) =>
    urls.push({
      url: `${SITE_URL}/release/${r.slug}`,
      lastModified: r.updated_at ?? undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    })
  );

  const { data: arts } = await supa
    .from('articles')
    .select('slug,updated_at,is_published')
    .eq('is_published', true)
    .limit(5000);

  (arts ?? []).forEach((a: any) =>
    urls.push({
      url: `${SITE_URL}/articles/${a.slug}`,
      lastModified: a.updated_at ?? undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    })
  );

  return urls;
}
