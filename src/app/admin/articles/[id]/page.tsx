'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type Row = {
  id?: number;
  kind: 'article' | 'review';
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  body: string | null;
  author: string | null;
  published_at: string | null;
  featured_slider: boolean;
};

type DbArticle = Row & { id: number }; // ensured id is present when loading from DB

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

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

  useEffect(() => {
    (async () => {
      const { data: meAdmin } = await supabase.rpc('me_is_admin');
      if (!meAdmin) { setOk(false); setLoading(false); return; }
      setOk(true);

      if (!isNew) {
        const num = Number(id);
        let r: DbArticle | null = null;
        if (Number.isFinite(num)) {
          const { data } = await supabase
            .from('articles')
            .select('*')
            .eq('id', num)
            .single<DbArticle>();
          r = data ?? null;
        }
        if (!r) { setErr('Article not found'); setLoading(false); return; }
        setRow({
          id: r.id,
          kind: r.kind,
          title: r.title,
          slug: r.slug,
          cover_url: r.cover_url,
          excerpt: r.excerpt,
          body: r.body,
          author: r.author,
          published_at: r.published_at,
          featured_slider: !!r.featured_slider,
        });
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const canSave = useMemo(() => row.title.trim().length > 0, [row.title]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const payload = {
      ...row,
      slug: slugify(row.slug || row.title),
      cover_url: row.cover_url?.trim() || null,
      excerpt: row.excerpt?.trim() || null,
      body: row.body || null,
      author: row.author?.trim() || null,
      published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
    };

    if (isNew) {
      const { data, error } = await supabase.from('articles').insert(payload).select('id').single<{ id: number }>();
      if (error) { setErr(error.message); return; }
      alert('Article created'); router.push(`/admin/articles/${data!.id}`);
    } else {
      const { error } = await supabase.from('articles').update(payload).eq('id', row.id!);
      if (error) { setErr(error.message); return; }
      alert('Saved');
    }
  }

  async function destroy() {
    if (isNew || !row.id) return;
    if (!confirm('Delete this article?')) return;
    const { error } = await supabase.from('articles').delete().eq('id', row.id);
    if (error) { alert(error.message); return; }
    router.push('/admin/articles');
  }

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking…</main>;
  if (ok === false) return <main className="mx-auto max-w-4xl px-4 py-8">No access.</main>;
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{isNew ? 'New' : 'Edit'} {row.kind === 'review' ? 'Review' : 'Article'}</h1>
        {!isNew && (
          <button onClick={destroy} className="text-sm px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20">
            Delete
          </button>
        )}
      </div>

      {err && <div className="mb-4 text-sm rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-300">{err}</div>}

      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <input className="input" placeholder="Title" value={row.title} onChange={(e) => setRow((r) => ({ ...r, title: e.target.value }))} required />
        <input className="input" placeholder="Slug" value={row.slug} onChange={(e) => setRow((r) => ({ ...r, slug: e.target.value }))} />

        <input className="input sm:col-span-2" placeholder="Cover URL" value={row.cover_url ?? ''} onChange={(e) => setRow((r) => ({ ...r, cover_url: e.target.value }))} />
        <input className="input sm:col-span-2" placeholder="Author" value={row.author ?? ''} onChange={(e) => setRow((r) => ({ ...r, author: e.target.value }))} />
        <input
          className="input"
          type="datetime-local"
          value={row.published_at ? new Date(row.published_at).toISOString().slice(0, 16) : ''}
          onChange={(e) => setRow((r) => ({ ...r, published_at: e.target.value }))}
        />
        <input className="input" placeholder="Excerpt" value={row.excerpt ?? ''} onChange={(e) => setRow((r) => ({ ...r, excerpt: e.target.value }))} />

        <textarea
          className="input sm:col-span-2 min-h-64"
          placeholder="Body (markdown or plain text)"
          value={row.body ?? ''}
          onChange={(e) => setRow((r) => ({ ...r, body: e.target.value }))}
        />

        <div className="sm:col-span-2 mt-2">
          <button className="btn" type="submit" disabled={!canSave}>Save</button>
          <Link href="/admin/articles" className="ml-2 text-sm opacity-80 hover:opacity-100 underline">Back</Link>
        </div>
      </form>

      <style jsx>{`
        .input { background:#0a0a0a; border:1px solid #27272a; border-radius:0.5rem; padding:0.5rem 0.75rem; color:#f4f4f5; outline:none; }
        .btn { background:#f97316; color:#000; font-weight:700; border-radius:0.5rem; padding:0.6rem 0.9rem; }
      `}</style>
    </main>
  );
}
