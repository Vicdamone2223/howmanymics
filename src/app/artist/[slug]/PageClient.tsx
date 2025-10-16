// src/app/artist/[slug]/PageClient.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Rating from "@/components/Rating";

type RareClip = {
  id?: number | string;
  artist_id?: number | string;
  title: string;
  url: string;
  kind?: "interview" | "freestyle" | "performance" | "other" | null;
};

type Artist = {
  id: number | string;
  name: string;
  slug: string;
  card_img_url: string | null;
  origin: string | null;
  years_active: string | null;
  bio: string | null;
  rating_staff: number | null;

  // Achievements
  billboard_hot100_entries?: number | null;
  platinum?: number | null;
  grammys?: number | null;

  // SEO + long form
  seo_title?: string | null;
  seo_description?: string | null;

  bio_long_intro?: string | null;
  bio_long_early?: string | null;
  bio_long_mixtapes?: string | null;
  bio_long_albums?: string | null;
  bio_long_business?: string | null;
  bio_long_legacy?: string | null;
  bio_sources?: string | null;

  // JSON fallback for rare clips
  rare_clips?: RareClip[] | null;
};

type Release = {
  id: number | string;
  title: string;
  slug: string;
  year: number | null;
  cover_url: string | null;
};

type NameSlug = { name: string; slug: string };

// ---------- linkify helpers ----------
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function makeNameRegex(names: string): RegExp | null {
  if (!names) return null;
  return new RegExp(`(^|[^\\p{L}])(${names})(?=$|[^\\p{L}])`, "giu");
}
function linkifyText(
  text: string,
  index: Map<string, string>,
  currentSlug?: string
): ReactNode {
  if (!text) return text;

  const names = Array.from(index.keys())
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

  const rx = makeNameRegex(names);
  if (!rx) return text;

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(text)) !== null) {
    const matchStart = m.index;
    const beforeSep = m[1] ?? "";
    const matchedName = m[2] ?? "";

    if (matchStart > last) out.push(text.slice(last, matchStart));
    if (beforeSep) out.push(beforeSep);

    const slug = index.get(matchedName.toLowerCase());
    const shouldLink = slug && slug !== currentSlug;
    const key = `${slug || "txt"}-${last}-${rx.lastIndex}`;

    out.push(
      shouldLink ? (
        <Link key={key} href={`/artist/${slug}`} className="underline hover:opacity-100 opacity-90">
          {matchedName}
        </Link>
      ) : (
        matchedName
      )
    );

    last = rx.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
// -------------------------------------

export default function PageClient({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Release[]>([]);
  const [clips, setClips] = useState<RareClip[]>([]);

  // name → slug index for linkifying
  const [nameIndex, setNameIndex] = useState<Map<string, string>>(new Map());
  const [namesLoaded, setNamesLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: aRow, error: aErr } = await supabase
        .from("artists")
        .select("*, rating_staff, rare_clips")
        .eq("slug", slug)
        .single();

      if (aErr || !aRow) {
        setLoading(false);
        return;
      }
      const a = aRow as Artist;
      setArtist(a);

      // Releases via junction (preferred) or legacy column
      let rels: Release[] = [];
      const { data: ra } = await supabase
        .from("release_artists")
        .select("release:release_id (id,title,slug,year,cover_url), artist_id")
        .eq("artist_id", a.id)
        .order("position", { ascending: true });

      if (ra && ra.length) {
        rels = (ra as any[]).map((r) => r.release).filter(Boolean) as Release[];
      } else {
        const { data: legacy } = await supabase
          .from("releases")
          .select("id,title,slug,year,cover_url")
          .eq("artist_id", a.id)
          .order("year", { ascending: true, nullsFirst: false });
        rels = (legacy || []) as Release[];
      }

      // earliest → latest; nulls last
      rels = [...rels].sort((a, b) => {
        const ay = a.year ?? Number.POSITIVE_INFINITY;
        const by = b.year ?? Number.POSITIVE_INFINITY;
        if (ay !== by) return ay - by;
        return String(a.title).localeCompare(String(b.title));
      });
      setAlbums(rels);

      // Rare Clips: prefer table; fallback to JSON on artist row
      let rcList: RareClip[] = [];
      const { data: rc, error: rcErr } = await supabase
        .from("rare_clips")
        .select("id,artist_id,title,url,kind")
        .eq("artist_id", a.id)
        .order("id", { ascending: false });

      if (!rcErr && rc && rc.length) {
        rcList = rc as RareClip[];
      } else if (Array.isArray(a.rare_clips) && a.rare_clips.length) {
        rcList = a.rare_clips
          .map((x, i) => ({
            id: x.id ?? `json-${i}`,
            artist_id: a.id,
            title: (x.title ?? "").trim(),
            url: (x.url ?? "").trim(),
            kind: x.kind ?? null,
          }))
          .filter((x) => x.title || x.url);
      }
      setClips(rcList);

      setLoading(false);
    })();
  }, [slug]);

  // Load name index for linkifying
  useEffect(() => {
    let alive = true;
    (async () => {
      const PAGE = 500;
      let from = 0;
      const map = new Map<string, string>();
      while (true) {
        const { data, error } = await supabase
          .from("artists")
          .select("name,slug")
          .order("name", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) break;
        if (!data || data.length === 0) break;

        for (const r of data as NameSlug[]) {
          const n = (r.name || "").trim();
          const s = (r.slug || "").trim();
          if (!n || !s) continue;
          map.set(n.toLowerCase(), s);
        }

        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (!alive) return;
      setNameIndex(map);
      setNamesLoaded(true);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const sections = useMemo(() => {
    if (!artist) return [];
    const S: Array<{ h: string; body: string | null | undefined }> = [
      { h: "Overview", body: artist.bio_long_intro },
      { h: "Early life & come-up", body: artist.bio_long_early },
      { h: "Mixtape era", body: artist.bio_long_mixtapes },
      { h: "Albums & runs", body: artist.bio_long_albums },
      { h: "Business & label", body: artist.bio_long_business },
      { h: "Legacy & influence", body: artist.bio_long_legacy },
    ];
    return S.filter((s) => (s.body ?? "").trim().length > 0);
  }, [artist]);

  const badges = useMemo(() => {
    if (!artist) return [];
    const arr: Array<{ label: string; title: string }> = [];
    const grammys = artist.grammys ?? 0;
    const plat = artist.platinum ?? 0;
    const hot100 = artist.billboard_hot100_entries ?? 0;

    if (grammys > 0) arr.push({ label: `🏆 ${grammys} Grammy${grammys === 1 ? "" : "s"}`, title: "Grammy Awards" });
    if (plat > 0) arr.push({ label: `💿 ${plat}× Platinum`, title: "RIAA Platinum awards (albums sold by millions)" });
    if (hot100 > 0) arr.push({ label: `📈 ${hot100} Hot 100`, title: "Billboard Hot 100 entries" });

    return arr;
  }, [artist]);

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8">Loading…</main>;
  if (!artist) return <main className="mx-auto max-w-4xl px-4 py-8">Artist not found.</main>;

  // We still compute these but we no longer show the tagline line under the name
  const desc = artist.seo_description || artist.bio || `Profile and discography for ${artist.name}.`;

  const renderLinkedPara = (t: string, i: number) => (
    <p key={i} className="opacity-90 leading-relaxed">
      {namesLoaded ? linkifyText(t, nameIndex, artist.slug) : t}
    </p>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artist.card_img_url || "/placeholder/nas-card.jpg"}
          alt={artist.name}
          className="h-28 w-28 rounded-xl object-cover border border-zinc-800"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">{artist.name}</h1>

          {/* Removed the tagline line below the name */}
          {/* <p className="opacity-75 text-sm mt-1">{linkifyText(desc, nameIndex, artist.slug)}</p> */}

          {/* quick facts & badges */}
          <div className="mt-2 text-xs opacity-70 flex flex-wrap gap-4">
            {artist.origin && <span>From: {artist.origin}</span>}
            {artist.years_active && <span>Years active: {artist.years_active}</span>}
          </div>

          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <span
                  key={i}
                  title={b.title}
                  className="text-[11px] px-2 py-1 rounded-full border border-zinc-800 bg-zinc-950/50"
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {/* Member rating + OVERALL ONLY chip */}
          <div className="mt-3">
            <Rating kind="artist" itemId={artist.id} summaryMode="overall-only" />
          </div>
        </div>
      </header>

      {/* Short bio */}
      {artist.bio && (
        <section className="mt-6">
          {renderLinkedPara(artist.bio, 0)}
        </section>
      )}

      {/* Long-form sections with dividers between each section */}
      {sections.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold mb-3">Biography</h2>
          <div className="divide-y divide-zinc-800">
            {sections.map((s, i) => (
              <article key={i} className="py-5 first:pt-0">
                <h3 className="text-lg font-semibold mb-2">{s.h}</h3>
                {(s.body || "")
                  .split(/\n{2,}/)
                  .map((para, j) => (
                    <div key={j} className={j > 0 ? "mt-2" : undefined}>
                      {renderLinkedPara(para, j)}
                    </div>
                  ))}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Discography (earliest → latest) */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Albums</h2>
          <Link href="/releases" className="text-sm underline opacity-80 hover:opacity-100">
            Browse all releases →
          </Link>
        </div>
        {albums.length === 0 ? (
          <p className="mt-2 opacity-70 text-sm">No albums found.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {albums.map((r) => (
              <li key={String(r.id)} className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/40">
                <Link href={`/release/${r.slug}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.cover_url || "/placeholder/cover1.jpg"} alt={r.title} className="w-full aspect-square object-cover" />
                  <div className="p-2">
                    <div className="font-semibold truncate">{r.title}</div>
                    <div className="text-xs opacity-70">{r.year ?? "—"}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rare clips */}
      {clips.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold mb-3">Rare Clips</h2>
          <ul className="space-y-2">
            {clips.map((c, i) => {
              const href = (c.url || "").trim();
              const title = (c.title || href || "Clip").trim();
              if (!href) return null;
              return (
                <li key={String(c.id ?? i)} className="text-sm">
                  <a href={href} target="_blank" rel="noreferrer" className="underline opacity-90 hover:opacity-100">
                    {title}
                  </a>
                  {c.kind && <span className="ml-2 opacity-60 text-xs">({c.kind})</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Sources */}
      {artist.bio_sources && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-2">Sources</h2>
          <ul className="list-disc list-inside text-sm opacity-80 space-y-1">
            {artist.bio_sources.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              return (
                <li key={i}>
                  <a href={t} target="_blank" rel="noreferrer" className="underline">{t}</a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
