// src/lib/seo.ts
import type { Metadata } from 'next';

export type SeoInput = {
  baseTitle: string;          // fallback title (e.g., "Illmatic | HowManyMics")
  baseDescription?: string;   // fallback description
  canonical?: string;         // absolute URL
  ogImage?: string | null;
  // Optional table overrides from DB:
  seo_title?: string | null;
  seo_description?: string | null;
};

export function buildMetadata(input: SeoInput): Metadata {
  const title = (input.seo_title && input.seo_title.trim()) || input.baseTitle;
  const description =
    (input.seo_description && input.seo_description.trim()) || input.baseDescription || '';

  // minimal, clean defaults
  const md: Metadata = {
    title,
    description,
    alternates: input.canonical ? { canonical: input.canonical } : undefined,
    openGraph: {
      title,
      description,
      images: input.ogImage ? [input.ogImage] : undefined,
      siteName: 'HowManyMics',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: input.ogImage ? [input.ogImage] : undefined,
    },
  };
  return md;
}

// Small helper to emit JSON-LD
export function jsonLd(obj: Record<string, any>) {
  return {
    __html: JSON.stringify(obj, null, 0),
  };
}
