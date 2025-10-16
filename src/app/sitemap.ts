// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Make a client only if env vars exist; otherwise return null (build-safe). */
function makeClient(): SupabaseClient | null {
  if (!SUPA_URL || !SUPA_KEY) return null;
  try {
    return createClient(SUPA_URL, SUPA_KEY);
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/artists`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/releases`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/articles`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "weekly", priority: 0.6 },
  ];

  const supa = makeClient();
  if (!supa) {
    // No Supabase at build/runtime — return the static set above.
    return urls;
  }

  // Helper to push a URL once
  const seen = new Set<string>();
  const pushOnce = (entry: MetadataRoute.Sitemap[number]) => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    urls.push(entry);
  };

  try {
    const { data: artists } = await supa
      .from("artists")
      .select("slug,updated_at")
      .limit(5000);

    (artists ?? []).forEach((a: any) =>
      pushOnce({
        url: `${SITE_URL}/artist/${a.slug}`,
        lastModified: a?.updated_at ? new Date(a.updated_at).toISOString() : undefined,
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );
  } catch {
    /* ignore — keep sitemap functional */
  }

  try {
    const { data: releases } = await supa
      .from("releases")
      .select("slug,updated_at")
      .limit(5000);

    (releases ?? []).forEach((r: any) =>
      pushOnce({
        url: `${SITE_URL}/release/${r.slug}`,
        lastModified: r?.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );
  } catch {
    /* ignore */
  }

  try {
    const { data: arts } = await supa
      .from("articles")
      .select("slug,updated_at,is_published")
      .eq("is_published", true)
      .limit(5000);

    (arts ?? []).forEach((a: any) =>
      pushOnce({
        url: `${SITE_URL}/articles/${a.slug}`,
        lastModified: a?.updated_at ? new Date(a.updated_at).toISOString() : undefined,
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );
  } catch {
    /* ignore */
  }

  return urls;
}
