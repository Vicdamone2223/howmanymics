"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Rating from "@/components/Rating";

type ArtistRow = { id: number | string; name: string; slug: string };

type ReleaseRow = {
  id: number | string;
  title: string | null;
  slug: string;
  year: number | null;
  cover_url: string | null;

  producers: string | string[] | null;
  labels: string | string[] | null;

  youtube_id: string | null;
  riaa_cert: string | null;

  // legacy columns (may be empty, kept for fallback)
  tracks: any[] | null;
  tracks_disc1: any[] | null;
  tracks_disc2: any[] | null;
  is_double_album: boolean | null;

  album_info?: string | null;
  artist_id?: number | string | null;
  rating_staff?: number | null;
};

type SimilarLite = { id: number | string; slug: string; title: string; cover_url: string | null };

type Feature = { id?: number | string | null; name: string; slug?: string | null };
type Track = { title: string; features: Feature[] };

type NameSlug = { name: string; slug: string };

// ➕ Review articles shown on the album page
type ReviewArticle = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  excerpt: string | null;
  published_at: string | null;
  author?: string | null;
};

// ---------- tiny utils ----------
function asArray<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function normalizePeople(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
function extractId(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  const m =
    s.match(/[?&]v=([a-zA-Z0-9_-]{10,})/) ||
    s.match(/youtu\.be\/([a-zA-Z0-9_-]{10,})/) ||
    s.match(/embed\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : null;
}
function YouTube({ id }: { id: string }) {
  const vid = extractId(id);
  if (!vid) return null;
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?rel=0&modestbranding=1`;
  return (
    <div className="video-wrap">
      <iframe
        src={src}
        title="Album video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        allowFullScreen
      />
      <style jsx>{`
        .video-wrap {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          overflow: hidden;
          border-radius: 0.75rem;
          border: 1px solid #27272a;
          background: #000;
        }
        .video-wrap > iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
function normalizeRiaa(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/\bx\b/gi, "×");
}
function RIAABadge({ cert }: { cert: string | null | undefined }) {
  const label = normalizeRiaa(cert);
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 bg-cyan-500/20 text-cyan-200 ring-cyan-600/40"
      title="RIAA Certification"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
        <path d="M12 2l2.39 4.84L20 8l-4 3.9.94 5.48L12 15.77 7.06 17.38 8 11.9 4 8l5.61-1.16L12 2z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}

// ---------- linkify helpers (same approach as artist page) ----------
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function makeNameRegex(namesPipe: string): RegExp | null {
  if (!namesPipe) return null;
  return new RegExp(`(^|[^\\p{L}])(${namesPipe})(?=$|[^\\p{L}])`, "giu");
}
function linkifyText(text: string, index: Map<string, string>): ReactNode {
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
    if (slug) {
      out.push(
        <Link key={`${slug}-${last}-${rx.lastIndex}`} href={`/artist/${slug}`} className="underline hover:opacity-100 opacity-90">
          {matchedName}
        </Link>
      );
    } else {
      out.push(matchedName);
    }
    last = rx.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** ---------- Markdown-lite renderer with robust singles date parsing ---------- */

// Parse "… — 1995-07-23", "… - 07/23/1995", "… — (1993 02 04)" etc. (at line END only)
function parseSingleWithDate(line: string): { title: string; dateText: string | null } {
  const trimmed = (line || "").trim();

  // Find a trailing date after a hyphen/en dash
  const match = trimmed.match(
    /\s(?:—|-)\s*(\(?\d{4}[-/ ]\d{1,2}[-/ ]\d{1,2}\)?|\(?\d{1,2}[-/ ]\d{1,2}[-/ ]\d{4}\)?)\s*$/,
  );

  let title = trimmed;
  let dateText: string | null = null;

  if (match && match.index != null) {
    title = trimmed.slice(0, match.index).trim();

    const rawDate = match[1].replace(/[()]/g, "").trim();
    const norm = rawDate.replace(/\s+/g, "-").replace(/\//g, "-");

    // yyyy-mm-dd
    let y: number | null = null;
    let m: number | null = null;
    let d: number | null = null;

    let m1 = norm.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    let m2 = norm.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); // mm-dd-yyyy

    if (m1) {
      y = +m1[1]; m = +m1[2]; d = +m1[3];
    } else if (m2) {
      y = +m2[3]; m = +m2[1]; d = +m2[2];
    }

    if (y && m && d) {
      // Create in UTC to avoid TZ shifting
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (!isNaN(dt.getTime())) {
        dateText = dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
      }
    }
  }

  return { title, dateText };
}

function AlbumMarkdown({
  text,
  linkify,
}: {
  text: string;
  linkify: (s: string) => ReactNode;
}) {
  // supports: "## Heading", paragraphs, "- list items" (Singles)
  const lines = (text || "").split(/\r?\n/);

  const blocks: Array<{ type: "h2" | "p" | "ul"; content: string[] }> = [];
  let cur: { type: "p" | "ul"; content: string[] } | null = null;

  const flush = () => { if (cur) blocks.push(cur); cur = null; };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^##\s+/.test(line)) {
      flush();
      blocks.push({ type: "h2", content: [line.replace(/^##\s+/, "").trim()] });
      continue;
    }
    if (/^-\s+/.test(line)) {
      if (!cur || cur.type !== "ul") { flush(); cur = { type: "ul", content: [] }; }
      cur.content.push(line.replace(/^-\s+/, ""));
      continue;
    }
    if (line === "") { flush(); continue; }

    if (!cur || cur.type !== "p") { flush(); cur = { type: "p", content: [] }; }
    cur.content.push(line);
  }
  flush();

  return (
    <article className="markdown-body">
      {blocks.map((b, i) => {
        if (b.type === "h2") {
          return (
            <h2 key={i} className="text-lg font-bold mt-5 mb-2">
              {b.content[0]}
            </h2>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className="list-disc pl-5 my-2 space-y-1">
              {b.content.map((item, j) => {
                const { title, dateText } = parseSingleWithDate(item);
                return (
                  <li key={j}>
                    {linkify(title)}
                    {dateText ? ` — ${dateText}` : ""}
                  </li>
                );
              })}
            </ul>
          );
        }
        return (
          <p key={i} className="opacity-90 my-2 whitespace-pre-wrap leading-7">
            {linkify(b.content.join("\n"))}
          </p>
        );
      })}
      <style jsx>{`
        /* safety if no typography plugin */
        .markdown-body :global(h2) { scroll-margin-top: 80px; }
      `}</style>
    </article>
  );
}

// ---------- page ----------
export default function PageClient({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rel, setRel] = useState<ReleaseRow | null>(null);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [similars, setSimilars] = useState<SimilarLite[]>([]);
  const [disc1, setDisc1] = useState<Track[]>([]);
  const [disc2, setDisc2] = useState<Track[]>([]);

  // name→slug index for linkifying album_info
  const [nameIndex, setNameIndex] = useState<Map<string, string>>(new Map());
  const [namesLoaded, setNamesLoaded] = useState(false);

  // ➕ reviews state
  const [reviews, setReviews] = useState<ReviewArticle[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      // Load release core
      const { data: rData, error: rErr } = await supabase
        .from("releases")
        .select(`
          id, title, slug, year, cover_url,
          producers, labels,
          youtube_id, riaa_cert,
          tracks, tracks_disc1, tracks_disc2, is_double_album,
          album_info, artist_id, rating_staff
        `)
        .eq("slug", slug)
        .maybeSingle();

      if (rErr) { if (alive) { setErr(rErr.message); setLoading(false); } return; }
      if (!rData) { if (alive) { setErr("Album not found."); setLoading(false); } return; }

      const release = rData as ReleaseRow;
      if (!alive) return;
      setRel(release);

      // Load artists (junction first, fallback to legacy)
      let artistRows: ArtistRow[] = [];
      const { data: raRows } = await supabase
        .from("release_artists")
        .select("artist_id, position")
        .eq("release_id", release.id)
        .order("position", { ascending: true });

      if (raRows?.length) {
        const ids = raRows.map((r: any) => r.artist_id).filter(Boolean);
        if (ids.length) {
          const { data: aRows } = await supabase
            .from("artists")
            .select("id,name,slug")
            .in("id", ids as any[]);
          artistRows = ((aRows || []) as ArtistRow[]);
        }
      } else if (release.artist_id != null) {
        const { data: a } = await supabase
          .from("artists")
          .select("id,name,slug")
          .eq("id", release.artist_id as any)
          .maybeSingle();
        if (a) artistRows = [a as ArtistRow];
      }
      if (!alive) return;
      setArtists(artistRows);

      // Tracks from view
      const { data: tRows, error: tErr } = await supabase
        .from("v_tracks_with_features")
        .select("disc_no, track_no, title, features")
        .eq("release_id", release.id)
        .order("disc_no", { ascending: true })
        .order("track_no", { ascending: true });

      if (tErr) {
        console.error("tracks view error:", tErr);
      } else {
        const d1: Track[] = [];
        const d2: Track[] = [];

        asArray<any>(tRows).forEach((row) => {
          const feats: Feature[] = asArray<any>(row.features).map((f) => ({
            id: f?.id ?? null,
            name: String(f?.name ?? "").trim(),
            slug: f?.slug ?? null,
          })).filter((f) => f.name);

          const trk: Track = { title: String(row.title || "").trim(), features: feats };
          const disc = Number(row.disc_no ?? 1);
          if (disc > 1) d2.push(trk); else d1.push(trk);
        });

        if (alive) { setDisc1(d1); setDisc2(d2); }
      }

      // Similar (optional)
      const { data: simJoin } = await supabase
        .from("release_similar")
        .select("position, similar_release_id")
        .eq("release_id", release.id)
        .order("position", { ascending: true });

      if (simJoin?.length) {
        const ids = simJoin.map((s: any) => s.similar_release_id).filter(Boolean);
        if (ids.length) {
          const { data: sRows } = await supabase
            .from("releases")
            .select("id,slug,title,cover_url")
            .in("id", ids as any[]);
          const sim = ((sRows || []) as any[]).map((x) => ({
            id: x.id, slug: x.slug, title: x.title, cover_url: x.cover_url ?? null,
          })) as SimilarLite[];
          if (alive) setSimilars(sim);
        }
      }

      // ➕ Reviews for this release (articles.kind='review')
      {
        const { data: byId, error: idErr } = await supabase
          .from("articles")
          .select("id,title,slug,cover_url,excerpt,published_at,author,kind,is_published,release_id")
          .eq("is_published", true)
          .eq("kind", "review")
          .eq("release_id", release.id)
          .order("published_at", { ascending: false })
          .limit(12);

        let rows: ReviewArticle[] = (byId || []) as any;

        // Fallback if older reviews didn't store release_id
        if (!idErr && rows.length === 0) {
          const title = (release.title || "").trim();
          if (title) {
            const { data: byTitle } = await supabase
              .from("articles")
              .select("id,title,slug,cover_url,excerpt,published_at,author,kind,is_published")
              .eq("is_published", true)
              .eq("kind", "review")
              .ilike("title", `%${title}%`)
              .order("published_at", { ascending: false })
              .limit(6);
            rows = (byTitle || []) as any;
          }
        }

        if (alive) setReviews(rows);
      }

      if (alive) setLoading(false);
    })();

    return () => { alive = false; };
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
    return () => { alive = false; };
  }, []);

  const view = useMemo(() => {
    if (!rel) return null;
    return {
      title: rel.title || rel.slug,
      cover: rel.cover_url,
      year: rel.year ?? undefined,
      producers: normalizePeople(rel.producers),
      labels: normalizePeople(rel.labels),
      youtube: rel.youtube_id ?? undefined,
      riaa: rel.riaa_cert ?? undefined,
      albumInfo: rel.album_info ?? undefined,
      isDouble: (disc2.length > 0) || (!!rel.is_double_album && disc1.length > 0),
    };
  }, [rel, disc1.length, disc2.length]);

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  if (err) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-300 text-sm">{err}</div>
      </main>
    );
  }
  if (!rel || !view) return <main className="mx-auto max-w-5xl px-4 py-8">Not found.</main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={view.cover || "/placeholder/cover1.jpg"}
          alt={view.title}
          className="h-28 w-28 rounded-lg object-cover border border-zinc-800"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold leading-tight">{view.title}</h1>
            <RIAABadge cert={view.riaa} />
          </div>

          <div className="mt-1 text-sm opacity-90 flex items-center gap-2 flex-wrap">
            {artists.map((a, i) => (
              <span key={String(a.id)}>
                <Link href={`/artist/${a.slug}`} className="underline hover:opacity-100 opacity-90">
                  {a.name}
                </Link>
                {i < artists.length - 1 ? ", " : ""}
              </span>
            ))}
            {view.year ? <span>{artists.length ? " • " : ""}{view.year}</span> : null}
          </div>

          {/* People rating control (50–100) */}
          <div className="mt-2">
            <Rating kind="release" itemId={rel.id} />
          </div>

          {/* Producers / Labels */}
          <div className="mt-3 grid grid-cols-2 gap-6 text-sm">
            <div>
              {view.producers.length > 0 && (
                <>
                  <div className="opacity-70 text-xs">Producers</div>
                  <div>{view.producers.join(", ")}</div>
                </>
              )}
            </div>
            <div>
              {view.labels.length > 0 && (
                <>
                  <div className="opacity-70 text-xs">Labels</div>
                  <div>{view.labels.join(", ")}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* YouTube */}
      {view.youtube && <div className="mt-6"><YouTube id={view.youtube} /></div>}

      {/* Album Info (markdown-lite + linkified names) */}
      {view.albumInfo && (
        <section className="mt-8">
          <h2 className="font-bold mb-2">Album Info</h2>
          <AlbumMarkdown
            text={view.albumInfo || ""}
            linkify={(s) => (namesLoaded ? linkifyText(s, nameIndex) : s)}
          />
        </section>
      )}

      {/* Tracklist (from view) */}
      {(disc1.length > 0 || disc2.length > 0) && (
        <section className="mt-10">
          <h2 className="font-bold mb-3">Tracklist{view.isDouble ? " — Disc 1" : ""}</h2>

          {disc1.length > 0 ? (
            <ol className="list-decimal pl-6 space-y-1">
              {disc1.map((t, i) => (
                <li key={`d1-${i}`}>
                  <span>{t.title}</span>
                  {t.features && t.features.length > 0 ? (
                    <span className="opacity-80"> — feat.{" "}
                      {t.features.map((f, idx) => {
                        const name = f.name || "";
                        const slug = f.slug || "";
                        return slug ? (
                          <span key={name + idx}>
                            <Link href={`/artist/${slug}`} className="underline hover:opacity-100">{name}</Link>
                            {idx < t.features.length - 1 ? ", " : ""}
                          </span>
                        ) : (
                          <span key={name + idx}>
                            {name}{idx < t.features.length - 1 ? ", " : ""}
                          </span>
                        );
                      })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <div className="opacity-70 text-sm">No tracks yet.</div>
          )}

          {view.isDouble && (
            <>
              <h3 className="font-semibold mt-6 mb-2">Disc 2</h3>
              {disc2.length > 0 ? (
                <ol className="list-decimal pl-6 space-y-1">
                  {disc2.map((t, i) => (
                    <li key={`d2-${i}`}>
                      <span>{t.title}</span>
                      {t.features && t.features.length > 0 ? (
                        <span className="opacity-80"> — feat.{" "}
                          {t.features.map((f, idx) => {
                            const name = f.name || "";
                            const slug = f.slug || "";
                            return slug ? (
                              <span key={name + idx}>
                                <Link href={`/artist/${slug}`} className="underline hover:opacity-100">{name}</Link>
                                {idx < t.features.length - 1 ? ", " : ""}
                              </span>
                            ) : (
                              <span key={name + idx}>
                                {name}{idx < t.features.length - 1 ? ", " : ""}
                              </span>
                            );
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="opacity-70 text-sm">No tracks for disc 2.</div>
              )}
            </>
          )}
        </section>
      )}

      {/* ➕ Reviews */}
      {reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="font-bold mb-3">Reviews</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/articles/${r.slug}`}
                className="group rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.cover_url || "/placeholder/hero.jpg"}
                  alt={r.title}
                  className="w-full h-40 object-cover"
                />
                <div className="p-3">
                  <div className="font-semibold leading-tight group-hover:underline">{r.title}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {r.published_at ? new Date(r.published_at).toLocaleDateString() : "—"}
                    {r.author ? ` • ${r.author}` : ""}
                  </div>
                  {r.excerpt && <p className="text-sm opacity-80 line-clamp-2 mt-1">{r.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Similar */}
      <section className="mt-10">
        <h2 className="font-bold mb-3">Similar Albums</h2>
        {similars.length === 0 ? (
          <div className="opacity-70 text-sm">No similar albums yet.</div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {similars.map((s) => (
              <li key={String(s.id)} className="rounded-lg border border-zinc-800 overflow-hidden">
                <Link href={`/release/${s.slug}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.cover_url || "/placeholder/cover1.jpg"}
                    alt={s.title}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="p-2 text-sm font-semibold truncate">{s.title}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
