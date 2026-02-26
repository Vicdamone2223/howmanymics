'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks'; // ← NEW: make single newlines render as <br>

/* ---------- Types ---------- */
type Row = {
  id?: number;
  kind: 'article' | 'review';
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  body: string | null;           // rendered as Markdown
  author: string | null;
  published_at: string | null;   // ISO string (UTC) in DB
  featured_slider: boolean;
};

type DbArticle = Row & { id: number };

/* ---------- Utils ---------- */
function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Insert text at the cursor inside textarea
function insertAtCursor(textarea: HTMLTextAreaElement, snippet: string, selectOffset = 0) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + snippet + after;
  const pos = start + snippet.length + selectOffset;
  textarea.setSelectionRange(pos, pos);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// Convert naked image URLs on their own line to Markdown images
function autoConvertImageUrls(md: string) {
  const imgLine = /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg))(?:\s*)$/gim;
  return md.replace(imgLine, (_, url) => `![](${url})`);
}

/* ---------- Page ---------- */
export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const isNew = id === 'new';
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [row, setRow] = useState<Row>({
    kind: 'article',
    title: '',
    slug: '',
    cover_url: '',
    excerpt: '',
    body: '',
    author: '',
    published_at: '',
    featured_slider: false,
  });

  const [uploading, setUploading] = useState(false);            // cover upload
  const [inlineUploading, setInlineUploading] = useState(false); // inline image upload
  const [showPreview, setShowPreview] = useState(true);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: meAdmin, error } = await supabase.rpc('me_is_admin');
      if (error || !meAdmin) {
        setOk(false);
        setLoading(false);
        return;
      }
      setOk(true);

      if (!isNew) {
        const num = Number(id);
        if (Number.isFinite(num)) {
          const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', num)
            .single();
          if (error || !data) {
            setErr('Article not found');
            setLoading(false);
            return;
          }
          const r = data as DbArticle;
          setRow({
            id: r.id,
            kind: r.kind,
            title: r.title,
            slug: r.slug,
            cover_url: r.cover_url,
            excerpt: r.excerpt,
            body: r.body, // markdown
            author: r.author,
            published_at: r.published_at,
            featured_slider: !!r.featured_slider,
          });
        } else {
          setErr('Invalid ID');
        }
      }

      setLoading(false);
    })();
  }, [id, isNew]);

  // Auto-fill slug if blank
  useEffect(() => {
    if (!row.title) return;
    setRow((r) => (r.slug ? r : { ...r, slug: slugify(row.title) }));
  }, [row.title]);

  const canSave = useMemo(() => row.title.trim().length > 0, [row.title]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    // Normalize body
    const normalizedBody = autoConvertImageUrls(row.body || '');

    const payload: Row = {
      ...row,
      slug: slugify(row.slug || row.title),
      cover_url: row.cover_url?.trim() || null,
      excerpt: row.excerpt?.trim() || null,
      body: normalizedBody || null,
      author: row.author?.trim() || null,
      published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
      featured_slider: !!row.featured_slider,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('articles')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        setErr(error.message);
        return;
      }
      alert('Article created');
      router.push(`/admin/articles/${(data as { id: number }).id}`);
    } else {
      const { error } = await supabase.from('articles').update(payload).eq('id', row.id!);
      if (error) {
        setErr(error.message);
        return;
      }
      alert('Saved');
    }
  }

  // Cover upload
  async function handleCoverUpload(file: File) {
    try {
      setUploading(true);
      const baseSlug = slugify(row.slug || row.title || 'article');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `articles/${baseSlug}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
      setRow((r) => ({ ...r, cover_url: pub?.publicUrl || '' }));
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // Inline image upload → insert Markdown image at cursor
  async function handleInlineUpload(file: File) {
    try {
      setInlineUploading(true);
      const baseSlug = slugify(row.slug || row.title || 'article');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `articles/${baseSlug}-inline-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (publicUrl && bodyRef.current) {
        const snippet = `![](${publicUrl})`;
        insertAtCursor(bodyRef.current, snippet);
        setRow((r) => ({ ...r, body: (bodyRef.current as HTMLTextAreaElement).value }));
      }
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
    } finally {
      setInlineUploading(false);
    }
  }

  // Paste image from clipboard → upload & insert
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.kind === 'file') {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          handleInlineUpload(file);
          break;
        }
      }
    }
  }

  function openInsertImageUrl() {
    const url = prompt('Paste image URL (https://...)');
    if (!url || !bodyRef.current) return;
    const snippet = `![](${url.trim()})`;
    insertAtCursor(bodyRef.current, snippet);
    setRow((r) => ({ ...r, body: bodyRef.current!.value }));
  }

  function openInsertLink() {
    if (!bodyRef.current) return;
    const url = prompt('Paste link URL (https://...)') || '';
    const label = prompt('Link text (optional)') || '';
    if (!url) return;
    const snippet = `[${label || url}](${url})`;
    insertAtCursor(bodyRef.current, snippet);
    setRow((r) => ({ ...r, body: bodyRef.current!.value }));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) handleInlineUpload(f);
  }

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking…</main>;
  if (ok === false) return <main className="mx-auto max-w-4xl px-4 py-8">No access.</main>;
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">
          {isNew ? 'New' : 'Edit'} {row.kind === 'review' ? 'Review' : 'Article'}
        </h1>

        {!isNew && (
          <button
            onClick={async () => {
              if (isNew || !row.id) return;
              if (!confirm('Delete this article?')) return;
              const { error } = await supabase.from('articles').delete().eq('id', row.id);
              if (error) {
                alert(error.message);
                return;
              }
              router.push('/admin/articles');
            }}
            className="text-sm px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20"
          >
            Delete
          </button>
        )}
      </div>

      {err && (
        <div className="mb-4 text-sm rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-300">
          {err}
        </div>
      )}

      <form onSubmit={save} className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            className="input"
            value={row.kind}
            onChange={(e) => setRow((r) => ({ ...r, kind: e.target.value as Row['kind'] }))}
          >
            <option value="article">Article</option>
            <option value="review">Review</option>
          </select>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={row.featured_slider}
              onChange={(e) => setRow((r) => ({ ...r, featured_slider: e.target.checked }))}
            />
            Feature in homepage slider
          </label>

          <input
            className="input"
            placeholder="Title"
            value={row.title}
            onChange={(e) => setRow((r) => ({ ...r, title: e.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Slug"
            value={row.slug}
            onChange={(e) => setRow((r) => ({ ...r, slug: e.target.value }))}
          />
        </div>

        {/* Cover upload + URL field */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
          <input
            className="input"
            placeholder="Cover image URL"
            value={row.cover_url ?? ''}
            onChange={(e) => setRow((r) => ({ ...r, cover_url: e.target.value }))}
          />
          <label className={`inline-flex items-center gap-2 ${uploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCoverUpload(f);
              }}
            />
            <span className="btn">{uploading ? 'Uploading…' : 'Upload cover'}</span>
          </label>
        </div>

        {row.cover_url ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.cover_url}
              alt="Cover preview"
              className="h-36 rounded-lg object-cover border border-zinc-800"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Author"
            value={row.author ?? ''}
            onChange={(e) => setRow((r) => ({ ...r, author: e.target.value }))}
          />
          <input
            className="input"
            type="datetime-local"
            value={row.published_at ? new Date(row.published_at).toISOString().slice(0, 16) : ''}
            onChange={(e) => setRow((r) => ({ ...r, published_at: e.target.value }))}
          />
        </div>

        <input
          className="input"
          placeholder="Excerpt"
          value={row.excerpt ?? ''}
          onChange={(e) => setRow((r) => ({ ...r, excerpt: e.target.value }))}
        />

        {/* --- Editor Toolbar --- */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => {
            if (!bodyRef.current) return;
            insertAtCursor(bodyRef.current, '**bold**', -4);
          }}>Bold</button>
          <button type="button" className="btn-secondary" onClick={() => {
            if (!bodyRef.current) return;
            insertAtCursor(bodyRef.current, '_italic_', -6);
          }}>Italic</button>
          <button type="button" className="btn-secondary" onClick={() => {
            if (!bodyRef.current) return;
            insertAtCursor(bodyRef.current, '### Heading\n');
          }}>H3</button>
          <button type="button" className="btn-secondary" onClick={openInsertLink}>Link</button>
          <button type="button" className="btn-secondary" onClick={openInsertImageUrl}>Image (URL)</button>

          <label className={`btn-secondary inline-flex items-center gap-2 ${inlineUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={inlineUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleInlineUpload(f);
              }}
            />
            {inlineUploading ? 'Uploading…' : 'Upload Image'}
          </label>

          <label className="ml-auto inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />
            Live Preview
          </label>
        </div>

        {/* --- Editor + Preview --- */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={handleDrop}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <textarea
            ref={bodyRef}
            className="input min-h-[260px]"
            placeholder="Body (Markdown supported). Press Return for a line break (enabled)."
            value={row.body ?? ''}
            onChange={(e) => setRow((r) => ({ ...r, body: e.target.value }))}
            onPaste={handlePaste}
          />

          {showPreview && (
            <div className="rounded-lg border border-zinc-800 p-4 bg-[#0a0a0a] overflow-auto">
              <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Preview</div>
              <article className="prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]} // ← NEW: makes single newlines into <br>
                  components={{
                    img: ({ node, ...props }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...props}
                        alt={props.alt ?? ''}
                        className="rounded-lg border border-zinc-800 max-w-full h-auto my-6" // ← add space above/below images
                      />
                    ),
                    a: ({ node, ...props }) => (
                      <a {...props} className="underline decoration-orange-500 underline-offset-4 hover:opacity-90" />
                    ),
                  }}
                >
                  {row.body || '_Start typing to preview..._'}
                </ReactMarkdown>
              </article>
            </div>
          )}
        </div>

        <div className="mt-2">
          <button className="btn" type="submit" disabled={!canSave}>
            Save
          </button>
          <Link href="/admin/articles" className="ml-2 text-sm opacity-80 hover:opacity-100 underline">
            Back
          </Link>
        </div>
      </form>

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f4f4f5;
          outline: none;
        }
        .input::placeholder { color: #a1a1aa; }
        .input:focus { box-shadow: 0 0 0 2px rgba(249,115,22,0.35); }
        .btn {
          background: #f97316;
          color: #000;
          font-weight: 700;
          border-radius: 0.5rem;
          padding: 0.6rem 0.9rem;
        }
        .btn-secondary {
          background: #171717; color: #f4f4f5; font-weight: 600;
          border-radius: 0.5rem; padding: 0.4rem 0.7rem; border: 1px solid #27272a;
        }
        :global(.prose :where(h1,h2,h3,h4)) { margin-top: 1.25em; }
        :global(.prose p) { margin: 0.75em 0; }
        :global(.prose ul, .prose ol) { margin: 0.75em 0 0.75em 1.25em; }
        :global(.prose code) { background: #111216; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
        :global(.prose pre) { background: #111216; padding: 0.75rem; border-radius: 0.5rem; overflow: auto; }
      `}</style>
    </main>
  );
}
