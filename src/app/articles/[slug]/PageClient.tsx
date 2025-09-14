// src/app/articles/[slug]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SeoJsonLd from '@/components/SeoJsonLd';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { absUrl, SITE_NAME } from '@/lib/seo';

/* ---------- Server metadata ---------- */
const supaForMeta = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { data } = await supaForMeta
    .from('articles')
    .select('title,slug,dek,cover_url,is_published,meta_title,meta_description,og_image,noindex,kind')
    .eq('slug', params.slug)
    .single();

  if (!data) return { title: 'Article not found' };

  const title = data.meta_title || data.title;
  const description = data.meta_description || data.dek || SITE_NAME;
  const image = data.og_image || data.cover_url || '/placeholder/hero1.jpg';

  return {
    title,
    description,
    alternates: { canonical: absUrl(`/articles/${data.slug}`) },
    openGraph: {
      title,
      description,
      url: absUrl(`/articles/${data.slug}`),
      images: [{ url: absUrl(image) }],
      type: 'article',
    },
    twitter: {
      title,
      description,
      images: [absUrl(image)],
      card: 'summary_large_image',
    },
    robots:
      data.noindex || !data.is_published
        ? { index: false, follow: false }
        : { index: true, follow: true },
  };
}

/* ---------- Types ---------- */
type Row = {
  title: string;
  cover_url: string | null;
  body: string | null;
  author: string | null;
  published_at: string | null;
  kind: 'article' | 'review';
};

/* ---------- Page ---------- */
export default function ArticleReader() {
  const { slug } = useParams<{ slug: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('title,cover_url,body,author,published_at,kind')
        .eq('slug', slug)
        .single();

      if (error) {
        console.error('article fetch error:', error);
        setRow(null);
      } else {
        setRow((data || null) as Row | null);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-8">Loading…</main>;
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      {/* JSON-LD */}
      <SeoJsonLd
        json={{
          '@context': 'https://schema.org',
          '@type': row.kind === 'review' ? 'Review' : 'Article',
          headline: row.title,
          image: row.cover_url ? absUrl(row.cover_url) : undefined,
          author: row.author ? { '@type': 'Person', name: row.author } : undefined,
          datePublished: row.published_at || undefined,
          mainEntityOfPage: absUrl(`/articles/${slug}`),
        }}
      />

      <div className="text-xs uppercase opacity-60">
        {row.kind === 'review' ? 'Review' : 'Article'}
      </div>

      <h1 className="text-3xl font-extrabold">{row.title}</h1>

      <div className="text-sm opacity-70">
        {row.author ? <>By {row.author} • </> : null}
        {row.published_at ? new Date(row.published_at).toLocaleDateString() : null}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {row.cover_url && (
        <img
          src={row.cover_url}
          alt={row.title}
          className="w-full rounded-xl border border-zinc-800"
        />
      )}

      <ArticleBody body={row.body ?? ''} />
    </main>
  );
}

/* ---------- Body renderer (plain text -> blocks + embeds) ---------- */

function ArticleBody({ body }: { body: string }) {
  if (!body.trim()) return <p className="opacity-70">No content yet.</p>;
  const lines = body.replace(/\r\n/g, '\n').split('\n');

  return (
    <article className="space-y-3">
      {lines.map((line, i) => {
        const t = line.trim();

        if (onlyUrl(t) && isYouTubeUrl(t)) {
          const vid = extractYouTubeId(t);
          return vid ? <YouTubeBlock key={`yt-${i}`} id={vid} /> : <P key={`p-${i}`}>{line}</P>;
        }

        if (onlyUrl(t) && isTwitterUrl(t)) {
          return <TwitterEmbed key={`tw-${i}`} url={t} />;
        }

        if (onlyUrl(t) && isInstagramUrl(t)) {
          return <InstagramEmbed key={`ig-${i}`} url={t} />;
        }

        return <P key={`p-${i}`}>{linkifyToNodes(line)}</P>;
      })}
    </article>
  );
}

/* ---------- Blocks / Embeds ---------- */

function P({ children }: { children: React.ReactNode }) {
  return <p className="prose prose-invert max-w-none">{children}</p>;
}

function YouTubeBlock({ id }: { id: string }) {
  return (
    <div className="my-4">
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function TwitterEmbed({ url }: { url: string }) {
  useEffect(() => {
    (window as any)?.twttr?.widgets?.load?.();
  }, [url]);

  return (
    <div className="my-4">
      <blockquote className="twitter-tweet">
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}

function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    (window as any)?.instgrm?.Embeds?.process?.();
  }, [url]);

  return (
    <div className="my-4">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ background: '#000', border: 0, margin: 0, padding: 0 }}
      >
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}

/* ---------- Helpers ---------- */
function onlyUrl(s: string) {
  return /^https?:\/\/\S+$/i.test(s);
}
function isYouTubeUrl(u: string) {
  return /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u);
}
function isTwitterUrl(u: string) {
  return /(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+/i.test(u);
}
function isInstagramUrl(u: string) {
  return /(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_\-]+/i.test(u);
}
function extractYouTubeId(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return cleanId(id);
    }
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/watch')) {
        const id = url.searchParams.get('v');
        return id ? cleanId(id) : null;
      }
      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return cleanId(id);
      }
      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return cleanId(id);
      }
    }
  } catch {}
  return null;
}
function cleanId(id: string | null) {
  if (!id) return null;
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}
function linkifyToNodes(text: string) {
  const parts: React.ReactNode[] = [];
  const urlRegex = /(https?:\/\/[^\s)]+)(?=[\s)]|$)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    const [url] = m;
    const start = m.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <a key={`${url}-${start}`} href={url} target="_blank" rel="noopener noreferrer" className="underline">
        {url}
      </a>
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}
