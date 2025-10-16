// src/app/layout.tsx
import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import './globals.css';
import ClientShell from '@/components/ClientShell';
import GA from '@/components/GA';

export const metadata: Metadata = {
  title: 'How Many Mics',
  description: 'Hip-hop rankings, releases, and debates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.howmanymics.com').replace(/\/$/, '');

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'How Many Mics',
    url: SITE_URL,
    logo: `${SITE_URL}/placeholder/hmmlogo.png`,
  };

  return (
    <html lang="en">
      <head>
        {/* ✅ Ezoic Privacy + Header scripts (already added earlier) */}
        <Script
          src="https://cmp.gatekeeperconsent.com/min.js"
          data-cfasync="false"
          strategy="beforeInteractive"
        />
        <Script
          src="https://the.gatekeeperconsent.com/cmp.min.js"
          data-cfasync="false"
          strategy="beforeInteractive"
        />
        <Script
          async
          src="//www.ezojs.com/ezoic/sa.min.js"
          strategy="beforeInteractive"
        />
        <Script id="ezstandalone-init" strategy="beforeInteractive">
          {`
            window.ezstandalone = window.ezstandalone || {};
            ezstandalone.cmd = ezstandalone.cmd || [];
          `}
        </Script>
      </head>

      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* 🔝 Ezoic Top of Page Ad */}
        <div id="ezoic-pub-ad-placeholder-101"></div>

        <Suspense fallback={null}>
          <GA />
          <ClientShell>{children}</ClientShell>
        </Suspense>

        {/* 🔚 Ezoic Bottom of Page Ad */}
        <div id="ezoic-pub-ad-placeholder-103"></div>

        {/* Organization JSON-LD */}
        <Script
          id="org-jsonld"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </body>
    </html>
  );
}
