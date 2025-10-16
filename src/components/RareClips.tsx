'use client';

import { useEffect } from 'react';

export default function RareClips({ items }: {
  items: { id: number; title: string; url: string; provider: string }[];
}) {
  useEffect(() => {
    // Ask embed providers to (re)render if scripts are present
    (window as any)?.twttr?.widgets?.load?.();
    (window as any)?.instgrm?.Embeds?.process?.();
  }, [items]);

  if (!items.length) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold mb-3">Rare Clips</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(c => (
          <div key={c.id} className="rounded-xl border border-zinc-800 p-3">
            <div className="font-semibold mb-2">{c.title}</div>
            <ClipEmbed provider={c.provider} url={c.url} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ClipEmbed({ provider, url }: { provider: string; url: string }) {
  if (provider === 'youtube') {
    const id = extractYouTubeId(url);
    return id ? (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-zinc-800">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    ) : <a className="underline" href={url} target="_blank">Open</a>;
  }

  if (provider === 'twitter') {
    return (
      <blockquote className="twitter-tweet">
        <a href={url}>{url}</a>
      </blockquote>
    );
  }

  if (provider === 'instagram') {
    return (
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ background: '#000', border: 0, margin: 0, padding: 0 }}
      >
        <a href={url}>{url}</a>
      </blockquote>
    );
  }

  return <a className="underline" href={url} target="_blank" rel="noreferrer">{url}</a>;
}

function extractYouTubeId(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.hostname.includes('youtu.be')) {
      return (url.pathname.split('/').filter(Boolean)[0] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    }
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/watch')) return (url.searchParams.get('v') || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (url.pathname.startsWith('/shorts/')) return (url.pathname.split('/').filter(Boolean)[1] || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (url.pathname.startsWith('/embed/')) return (url.pathname.split('/').filter(Boolean)[1] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    }
  } catch {}
  return null;
}
