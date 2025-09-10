'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Global click interceptor:
 * If any <a> points to http(s)://localhost[:port]/path,
 * prevent the hard navigation and client-route to the relative path instead.
 *
 * Rationale: Some legacy/demo code or imported content can have absolute
 * localhost URLs baked in. This neutralizes them app-wide.
 */
export default function LocalhostLinkGuard() {
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // only left-click without modifier keys
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // find the closest anchor
      const el = e.target as Element | null;
      const a = el?.closest?.('a') as HTMLAnchorElement | null;
      if (!a || !a.href) return;

      // only intercept real navigations
      const url = (() => {
        try { return new URL(a.href); } catch { return null; }
      })();
      if (!url) return;

      // Hosts we consider "bad absolute internal links"
      const isLocal =
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        url.pathname.startsWith('/');

      if (!isLocal) return;

      // If it’s "http://localhost:3000/whatever", route internally instead
      e.preventDefault();
      const next = `${url.pathname}${url.search}${url.hash}`;
      router.push(next);
    }

    // capture phase so we run before Next's default
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return null;
}
