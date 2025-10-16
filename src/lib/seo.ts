// src/lib/seo.ts
import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.howmanymics.com";

type SEOArgs = {
  baseTitle: string;
  baseDescription?: string | null;
  canonical?: string | null;     // absolute URL (we’ll normalize if relative)
  ogImage?: string | null;       // absolute or relative; we’ll absolutize
  ogType?: "website" | "article";
  noindex?: boolean;
};

function absoluteUrl(pathOrUrl?: string | null): string | undefined {
  if (!pathOrUrl) return undefined;
  try {
    // already absolute?
    const u = new URL(pathOrUrl);
    return u.toString();
  } catch {
    // relative → absolute
    return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  }
}

export function buildMetadata({
  baseTitle,
  baseDescription,
  canonical,
  ogImage,
  ogType = "article",
  noindex = false,
}: SEOArgs): Metadata {
  const title = baseTitle;
  const description = baseDescription || undefined;
  const url = absoluteUrl(canonical);
  const image = absoluteUrl(ogImage) || `${SITE_URL}/og-default.jpg`;

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: url ? { canonical: url } : undefined,
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },

    openGraph: {
      type: ogType,
      siteName: "How Many Mics",
      title,
      description,
      url,
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
