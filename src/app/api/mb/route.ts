// src/app/api/mb/route.ts
import type { NextRequest } from "next/server";

type Track = { title: string; features: string[] };

/* ---------- helpers ---------- */
function normName(v: unknown): string {
  const s = String(v || "").toLowerCase().trim();
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const cleanStr = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s || null;
};
const titleFrom = (t: any) =>
  cleanStr(t?.title) || cleanStr(t?.recording?.title) || cleanStr(t?.track?.title);

/* parse “(feat. …)” patterns too */
function parseTitleFeatures(title: string): string[] {
  const feats: string[] = [];
  const re =
    /\((?:feat\.|featuring)\s+([^)]+)\)|\[(?:feat\.|featuring)\s+([^\]]+)\]|(?:feat\.|featuring)\s+(.+)$/i;
  const m = title.match(re);
  const blob = (m?.[1] || m?.[2] || m?.[3] || "").trim();
  if (!blob) return feats;
  blob
    .split(/,|&| and |;|\u00b7|\u2022/gi)
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((n) => feats.push(n));
  return feats;
}
function artistNamesFromCredit(credit: any): string[] {
  if (!Array.isArray(credit)) return [];
  const out: string[] = [];
  for (const c of credit) {
    const nm =
      cleanStr(c?.name) || cleanStr(c?.artist?.name) || cleanStr(c?.artist) || null;
    if (nm) out.push(nm);
  }
  return out;
}
function featuresFromTrack(t: any, primarySet: Set<string>): string[] {
  const ac = Array.isArray(t?.["artist-credit"])
    ? t?.["artist-credit"]
    : Array.isArray(t?.recording?.["artist-credit"])
    ? t?.recording?.["artist-credit"]
    : null;

  const fromAC = artistNamesFromCredit(ac)
    .filter((n) => !primarySet.has(normName(n)));

  const fromTitle = parseTitleFeatures(titleFrom(t) || "");

  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...fromAC, ...fromTitle]) {
    const k = normName(n);
    if (!k || primarySet.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(n.trim());
  }
  return out;
}
function discsFromMB(json: any, primary: Set<string>): Track[][] {
  const media = Array.isArray(json?.media) ? json.media : [];
  const discs: Track[][] = [];
  for (const m of media) {
    const tracks = Array.isArray(m?.tracks) ? m.tracks : [];
    const rows: Track[] = [];
    for (const t of tracks) {
      const title = titleFrom(t);
      if (!title) continue;
      rows.push({ title, features: featuresFromTrack(t, primary) });
    }
    if (rows.length) discs.push(rows);
  }
  return discs;
}

/* ---------- route ---------- */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "";
  const primaryRaw = searchParams.getAll("primary");
  const primarySet = new Set(primaryRaw.map(normName));

  const UA =
    process.env.NEXT_PUBLIC_SITE_URL
      ? `HowManyMics (+${process.env.NEXT_PUBLIC_SITE_URL})`
      : "HowManyMics (+https://www.howmanymics.com)";

  if (!title) {
    return new Response(JSON.stringify({ disc1: [], disc2: [] as Track[] }), {
      headers: { "content-type": "application/json" },
    });
  }

  async function hydrate(id: string) {
    const url = `https://musicbrainz.org/ws/2/release/${id}?inc=recordings+artist-credits+media&fmt=json`;
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return r.json();
  }

  async function searchReleases(query: string) {
    const url = `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(
      query
    )}&fmt=json&limit=5`;
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (Array.isArray(j?.releases) ? j.releases : []) as any[];
  }

  try {
    const qTitle = `release:"${title}"`;
    const firstArtist = primaryRaw[0];
    const scopedQuery = firstArtist ? `${qTitle} AND artist:"${firstArtist}"` : qTitle;

    // 1) Try scoped to artist
    let candidates = await searchReleases(scopedQuery);

    // 2) Fallback: unscoped search if nothing useful (helps OutKast / Clipse variants)
    if (!candidates.length) {
      candidates = await searchReleases(qTitle);
    }

    // hydrate a few and pick the one with the most tracks (and artist-credits)
    let best: any | null = null;
    let bestScore = -1;
    for (const c of candidates.slice(0, 5)) {
      const h = await hydrate(c.id);
      if (!h) continue;
      const discs = discsFromMB(h, primarySet);
      const tracks = discs.reduce((n, d) => n + d.length, 0);
      const hasAC = !!h?.media?.[0]?.tracks?.[0]?.["artist-credit"] ||
        !!h?.media?.[0]?.tracks?.[0]?.recording?.["artist-credit"];
      const score = tracks + (hasAC ? 5 : 0);
      if (score > bestScore) {
        best = h;
        bestScore = score;
      }
    }

    if (!best) {
      return new Response(JSON.stringify({ disc1: [], disc2: [] }), {
        headers: { "content-type": "application/json" },
      });
    }

    const discs = discsFromMB(best, primarySet);
    const disc1 = discs[0] || [];
    const disc2 = discs[1] || [];
    return new Response(JSON.stringify({ disc1, disc2 }), {
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ disc1: [], disc2: [] }), {
      headers: { "content-type": "application/json" },
    });
  }
}
