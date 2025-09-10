// src/components/SocialEmbeds.tsx
'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SocialEmbeds() {
  const pathname = usePathname();

  // Re-run processors on route change so newly rendered embeds get hydrated
  useEffect(() => {
    const process = () => {
      // X / Twitter
      try {
        (window as any).twttr?.widgets?.load();
      } catch {}
      // Instagram
      try {
        (window as any).instgrm?.Embeds?.process();
      } catch {}
    };
    // Run after paint
    const t = setTimeout(process, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <Script
        src="https://platform.twitter.com/widgets.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            (window as any).twttr?.widgets?.load();
          } catch {}
        }}
      />
      <Script
        src="https://www.instagram.com/embed.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            (window as any).instgrm?.Embeds?.process();
          } catch {}
        }}
      />
    </>
  );
}
