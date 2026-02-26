'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';

/* ---------- Types ---------- */
type Row = {
  title: string;
  cover_url: string | null;
  body: string | null; // Markdown
  author: string | null;
  published_at: string | null;
  kind: 'article' | 'review';
};

export default function PageClient({ slug }: { slug: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('title,cover_url,body,author,published_at,kind')
        .eq('slug', slug)
        .single();

      if (!alive) return;
      if (error) {
        console.error('article fetch error:', error);
        setRow(null);
      } else {
        setRow((data || null) as Row | null);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-8">Loading…</main>;
  if (!row) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Article not found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      <div className="text-xs uppercase opacity-60">
        {row.kind === 'review' ? 'Review' : 'Article'}
      </div>

      <h1 className="text-3xl font-extrabold">{row.title}</h1>

      <div className="text-sm opacity-70">
        {row.author ? <>By {row.author} • </> : null}
        {row.published_at ? new Date(row.published_at).toLocaleDateString() : null}
      </div>

      {/* Hero image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {row.cover_url && (
        <img
          src={row.cover_url}
          alt={row.title}
          className="w-full rounded-xl border border-zinc-800"
        />
      )}

      <ArticleBodyMarkdown body={row.body ?? ''} />

      <style jsx global>{`
        .prose img {
          margin-top: 1rem;
          margin-bottom: 1.5rem;
          display: block;
        }
        .prose :where(h1, h2, h3, h4) {
          margin-top: 1.25em;
        }
        .prose p {
          margin: 0.9em 0;
        }
      `}</style>
    </main>
  );
}

/* ---------- Markdown Body Renderer ---------- */

function ArticleBodyMarkdown({ body }: { body: string }) {
  if (!body.trim()) return <p className="opacity-70">No content yet.</p>;

  return (
    <article className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ node, children }) => (
            <p className="mb-5 leading-relaxed">{children}</p>
          ),
          img: ({ node, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...props}
              alt={props.alt ?? ''}
              className="rounded-lg border border-zinc-800 max-w-full h-auto my-6"
            />
          ),
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="underline decoration-orange-500 underline-offset-4 hover:opacity-90"
              target={props.href?.startsWith('http') ? '_blank' : undefined}
              rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            />
          ),
        }}
      >
        {body.replace(/\n{2,}/g, '\n\n&nbsp;\n\n')}
      </ReactMarkdown>
    </article>
  );
}

/* ---------- Embeds ---------- */

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

function isAnchorElement(child: unknown): child is React.ReactElement<{ href?: string }> {
  return (
    !!child &&
    typeof child === 'object' &&
    child !== null &&
    'type' in (child as any) &&
    (child as any).type === 'a'
  );
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
      return cleanId(url.pathname.split('/').filter(Boolean)[0]);
    }
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/watch')) return cleanId(url.searchParams.get('v'));
      if (url.pathname.startsWith('/shorts/'))
        return cleanId(url.pathname.split('/').filter(Boolean)[1]);
      if (url.pathname.startsWith('/embed/'))
        return cleanId(url.pathname.split('/').filter(Boolean)[1]);
    }
  } catch {}
  return null;
}
function cleanId(id: string | null) {
  if (!id) return null;
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}
