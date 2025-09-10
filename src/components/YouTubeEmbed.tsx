'use client';

type Props = {
  /** Can be a full YouTube URL or just the video id */
  input?: string | null;
  /** Accessible title for the iframe */
  title?: string;
};

export default function YouTubeEmbed({ input, title = 'YouTube video' }: Props) {
  const id = extractYouTubeId(input || '');
  if (!id) return null;

  const embedSrc = `https://www.youtube-nocookie.com/embed/${id}?rel=0`;

  return (
    <div className="my-4">
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800">
        <iframe
          className="w-full h-full"
          src={embedSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="mt-2 text-xs opacity-75">
        If the player is blocked by an extension,{' '}
        <a
          href={`https://youtu.be/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          open on YouTube
        </a>
        .
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function extractYouTubeId(raw: string): string | null {
  const s = (raw || '').trim();
  if (!s) return null;

  // If it already looks like an ID (11-ish chars, no spaces, no slashes), accept it.
  if (/^[a-zA-Z0-9_-]{8,}$/.test(s) && !s.includes('http')) return cleanId(s);

  try {
    const url = new URL(s);

    // youtu.be/<id>
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return cleanId(id);
    }

    // youtube.com/watch?v=<id>
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/watch')) {
        const id = url.searchParams.get('v');
        return cleanId(id);
      }
      // youtube.com/shorts/<id>
      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return cleanId(id);
      }
      // youtube.com/embed/<id>
      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return cleanId(id);
      }
    }
  } catch {
    // not a URL — fall through
  }

  return null;
}

function cleanId(id?: string | null) {
  if (!id) return null;
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}
