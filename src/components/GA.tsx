// src/components/GA.tsx
'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function GA() {
  // Don’t load anything if no ID (e.g., local/dev without env set)
  if (!GA_ID) return null;

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Fire a config pageview on route changes (App Router)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const gtag = (window as any).gtag as
      | ((...args: any[]) => void)
      | undefined;

    if (!gtag) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '');
    gtag('config', GA_ID, {
      page_path: url,
      anonymize_ip: true,
    });
  }, [pathname, searchParams]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            anonymize_ip: true,
            page_path: window.location.pathname
          });
        `}
      </Script>
    </>
  );
}
