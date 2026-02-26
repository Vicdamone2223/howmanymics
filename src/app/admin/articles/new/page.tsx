'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabaseClient';

function slugify(s = '') {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Simple helper: insert text at the current cursor/selection in a textarea
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

// Converts any naked image URL on its own line to Markdown
function autoConvertImageUrls(md: string) {
  // line with just an http(s) URL that ends with an image extension
  const imgLine = /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg))(?:\s*)$/gim;
  return md.replace(imgLine, (_, url) => `![](${url})`);
}

export default function NewArticlePage() {
  const router = useRouter();

  const [ok, setOk] = useState<boolean | null>(null);

  // form fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [dek, setDek] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorSlug, setAuthorSlug] = useState('');
  const [featured, setFeatured] = useState(false);
  const [publishedDate, setPublishedDate] = useState(''); // YYYY-MM-DD
  const [bodyMd, setBodyMd] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inlineUploading, setInlineUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: isAdmin, error } = await supabase.rpc('me_is_admin');
      if (error) {
        setOk(false);
        return;
      }
      setOk(!!isAdmin);
    })();
  }, []);

  // Autofill slug from title if slug is empty
  useEffect(() => {
    if (!title) return;
    setSlug((prev) => (prev ? prev : slugify(title)));
  }, [title]);

  // Autofill authorSlug from authorName if blank
  useEffect(() => {
    if (!authorName) return;
    setAuthorSlug((prev) => (prev ? prev : slugify(authorName)));
  }, [authorName]);

  function toNull(s: string) {
    const t = s.trim();
    return t === '' ? null : t;
  }
  function dateToTzMidnight(dateStr: string | null) {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function handleCoverUpload(file: File) {
    try {
      setUploading(true);
      const baseSlug = slugify(slug || title || 'article');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `articles/${baseSlug}-cover-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
      if (pub?.publicUrl) setCoverUrl(pub.publicUrl);
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleInlineUpload(file: File) {
    try {
      setInlineUploading(true);
      const baseSlug = slugify(slug || title || 'article');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `articles/${baseSlug}-inline-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: false, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('assets').getPublicUrl(path);
      if (pub?.publicUrl && bodyRef.current) {
        // Insert markdown image at cursor
        const snippet = `![](${pub.publicUrl})`;
        insertAtCursor(bodyRef.current, snippet);
      }
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
    } finally {
      setInlineUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) handleInlineUpload(f);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // If user pastes an image file from clipboard, upload and insert
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

  function openInsertImageDialog() {
    const url = prompt('Paste image URL (https://...)');
    if (!url || !bodyRef.current) return;
    const snippet = `![](${url.trim()})`;
    insertAtCursor(bodyRef.current, snippet);
  }

  function openInsertLinkDialog() {
    if (!bodyRef.current) return;
    const url = prompt('Paste link URL (https://...)') || '';
    const label = prompt('Link text (optional)') || '';
    if (!url) return;
    const snippet = `[${label || url}](${url})`;
    insertAtCursor(bodyRef.current, snippet);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!title.trim()) {
      setErr('Title is required.');
      return;
    }
    const finalSlug = slugify(slug || title);

    // Convert naked image URLs to proper markdown so they render
    const normalizedBody = autoConvertImageUrls(bodyMd);

    const payload = {
      title: title.trim(),
      slug: finalSlug,
      dek: toNull(dek),
      excerpt: toNull(excerpt),
      body_md: toNull(normalizedBody),
      cover_url: toNull(coverUrl),
      author_name: toNull(authorName),
      author_slug: toNull(authorSlug || slugify(authorName || '')),
      featured_slider: !!featured,
      published_at: dateToTzMidnight(publishedDate || null),
    };

    try {
      setSaving(true);
      const { error } = await supabase.from('articles').insert(payload);
      if (error) throw error;
      alert('Article created.');
      router.push('/admin/articles');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not create article.';
      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  if (ok === null) return <main className="mx-auto max-w-5xl p-6">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-5xl p-6">No access.</main>;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">New Article</h1>
        <Link href="/admin/articles" className="text-sm opacity-80 hover:opacity-100 underline">
          ← Back
        </Link>
      </div>

      {err && (
        <div className="mb-4 text-sm rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-300">
          {err}
        </div>
      )}

      <form onSubmit={submit} className="grid grid-cols-1 gap-3">
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="input" placeholder="Slug (auto or edit)" value={slug} onChange={(e) => setSlug(e.target.value)} />

        <input className="input" placeholder="Dek (short kicker above title)" value={dek} onChange={(e) => setDek(e.target.value)} />
        <textarea className="input" placeholder="Excerpt (1–2 sentences)" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />

        {/* Cover upload + URL field */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
          <input className="input" placeholder="Cover image URL" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
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

        {coverUrl ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Cover preview"
              className="h-36 rounded-lg object-cover border border-zinc-800"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Author name" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
          <input className="input" placeholder="Author slug (auto)" value={authorSlug} onChange={(e) => setAuthorSlug(e.target.value)} />
        </div>

        <label className="inline-flex items-center gap-2 select-none">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          <span className="text-sm">Show in homepage slider</span>
        </label>

        <div>
          <div className="text-xs opacity-70 mb-1">Publish date (optional)</div>
          <input
            type="date"
            className="input"
            value={publishedDate}
            onChange={(e) => setPublishedDate(e.target.value)}
          />
          <div className="text-xs opacity-60 mt-1">If empty, the post remains unpublished (draft).</div>
        </div>

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
          <button type="button" className="btn-secondary" onClick={openInsertLinkDialog}>Link</button>
          <button type="button" className="btn-secondary" onClick={openInsertImageDialog}>
            Image (URL)
          </button>
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
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={handleDrop}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <textarea
            ref={bodyRef}
            className="input min-h-[260px]"
            placeholder="Body (Markdown supported). Tip: drag & drop an image file here or click 'Upload Image' to insert it where your cursor is. Use 'Image (URL)' to embed by link."
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            onPaste={handlePaste}
          />

          {showPreview && (
            <div className="rounded-lg border border-zinc-800 p-4 bg-[#0a0a0a] overflow-auto">
              <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Preview</div>
              <article className="prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ node, ...props }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img {...props} alt={props.alt ?? ''} className="rounded-lg border border-zinc-800 max-w-full h-auto" />
                    ),
                    a: ({ node, ...props }) => (
                      <a {...props} className="underline decoration-orange-500 underline-offset-4 hover:opacity-90" />
                    ),
                  }}
                >
                  {bodyMd || '_Start typing to preview..._'}
                </ReactMarkdown>
            </article>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Create Article'}
          </button>
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
          background: #f97316; color: #000; font-weight: 700;
          border-radius: 0.5rem; padding: 0.55rem 0.9rem;
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
