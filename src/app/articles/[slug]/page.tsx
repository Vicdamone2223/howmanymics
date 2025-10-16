// Server wrapper for Article route (with OpenGraph/Twitter metadata)

import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import PageClient from "./PageClient";

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://www.howmanymics.com").replace(/\/$/, "");
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

type ArticleMetaRow = {
  title: string;
  cover_url: string | null;
  excerpt: string | null;
  dek: string | null;
  is_published?: boolean | null;
  seo_description?: string | null;
};

async function fetchArticleMeta(slug: string): Promise<ArticleMetaRow | null> {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const url =
    `${SUPA_URL}/rest/v1/articles` +
    `?select=title,cover_url,excerpt,dek,is_published,seo_description` +
    `&slug=eq.${encodeURIComponent(slug)}` +
    `&limit=1`;

  const res = await fetch(url, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as ArticleMetaRow[];
  return rows?.[0] ?? null;
}

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const { slug } = (params ?? {}) as { slug: string };
  const row = await fetchArticleMeta(slug);

  const baseTitle = row?.title ? `${row.title} | How Many Mics` : "How Many Mics";
  const description =
    row?.seo_description || row?.dek || row?.excerpt || "Hip-hop rankings, releases, and debates.";
  const canonical = `${SITE_URL}/articles/${slug}`;
  const ogImage = row?.cover_url || `${SITE_URL}/og-default.jpg`;

  return buildMetadata({
    baseTitle,
    baseDescription: description,
    canonical,
    ogImage,
    ogType: "article",
    noindex: row?.is_published === false ? true : false,
  });
}

export default function Page({ params }: any) {
  const { slug } = (params ?? {}) as { slug: string };
  return <PageClient slug={slug} />;
}
