// src/app/search/page.tsx
import { supabase } from '@/lib/supabaseClient';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const term = q.trim();

  let artists: any[] = [];
  let releases: any[] = [];

  if (term) {
    const [{ data: a }, { data: r }] = await Promise.all([
      supabase
        .from('artists')
        .select('id,name,slug,card_img_url')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(25),
      supabase
        .from('releases')
        .select('id,title,slug,cover_url,year')
        .ilike('title', `%${term}%`)
        .order('year', { ascending: true })
        .limit(25),
    ]);
    artists = a || [];
    releases = r || [];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-4">Search</h1>

      {!term ? (
        <p className="opacity-70">Type in the search bar above.</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Artists</h2>
            {artists.length === 0 ? (
              <p className="opacity-70 text-sm">No artists found.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {artists.map(a => (
                  <li key={a.id} className="rounded-lg border border-zinc-800 p-3">
                    <a href={`/artist/${a.slug}`} className="flex items-center gap-3 hover:underline">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.card_img_url || '/placeholder/nas-card.jpg'}
                        alt={a.name}
                        className="h-12 w-12 rounded object-cover border border-zinc-800"
                      />
                      <span className="font-medium">{a.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Albums</h2>
            {releases.length === 0 ? (
              <p className="opacity-70 text-sm">No albums found.</p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {releases.map(r => (
                  <li key={r.id} className="rounded-lg border border-zinc-800 overflow-hidden">
                    <a href={`/release/${r.slug}`} className="block hover:underline">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.cover_url || '/placeholder/cover1.jpg'}
                        alt={r.title}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="p-2">
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs opacity-70">{r.year ?? '—'}</div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
