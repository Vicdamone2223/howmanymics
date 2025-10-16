'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

function slugify(s = '') {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
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
  const [err, setErr] = useState<string | null>(null);

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
      const path = `articles/${baseSlug}-${Date.now()}.${ext}`;

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!title.trim()) {
      setErr('Title is required.');
      return;
    }
    const finalSlug = slugify(slug || title);
    const payload = {
      title: title.trim(),
      slug: finalSlug,
      dek: toNull(dek),
      excerpt: toNull(excerpt),
      body_md: toNull(bodyMd),
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

  if (ok === null) return <main className="mx-auto max-w-3xl p-6">Checking access…</main>;
  if (!ok) return <main className="mx-auto max-w-3xl p-6">No access.</main>;

  return (
    <main className="mx-auto max-w-3xl p-6">
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

        <textarea
          className="input min-h-[180px]"
          placeholder="Body (Markdown optional)"
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
        />

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
      `}</style>
    </main>
  );
}
