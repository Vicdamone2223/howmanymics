// src/components/SocialEmbeds.tsx
'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SocialEmbeds() {
  const pathname = usePathname();

  // Re-run processors whenever the route changes so new embeds hydrate.
  useEffect(() => {
    const process = () => {
      try {
        // X / Twitter
        (window as any)?.twttr?.widgets?.load?.();
      } catch {}
      try {
        // Instagram
        (window as any)?.instgrm?.Embeds?.process?.();
      } catch {}
    };

    // Run on next tick (after DOM paints)
    const t = setTimeout(process, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      {/* Twitter / X embed script */}
      <Script
        id="tw-widgets"
        src="https://platform.twitter.com/widgets.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            (window as any)?.twttr?.widgets?.load?.();
          } catch {}
        }}
      />

      {/* Instagram embed script */}
      <Script
        id="ig-embed"
        src="https://www.instagram.com/embed.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            (window as any)?.instgrm?.Embeds?.process?.();
          } catch {}
        }}
      />
    </>
  );
}
