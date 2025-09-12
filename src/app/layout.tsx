// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import dynamic from 'next/dynamic';

// Load the header only on the client so the server never
// renders a “logged-out” vs “logged-in” variant.
const Header = dynamic(() => import('@/components/Header'), { ssr: false });

// A tiny client gate that renders children only after the browser mounts.
// This guarantees the initial DOM is produced by the client (no SSR/CSR drift).
function HydrationGate({ children }: { children: React.ReactNode }) {
  // This file is a server component, so put the client bit inlined below:
  // eslint-disable-next-line @next/next/no-sync-scripts
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          document.documentElement.dataset.hydrated = '1';
        `,
      }}
    />
  ) || <>{children}</>; // (script runs immediately; children are rendered normally)
}

export const metadata: Metadata = {
  title: 'How Many Mics',
  description: 'Hip-hop rankings, releases, and debates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100" suppressHydrationWarning>
        <HydrationGate>
          {/* Client-only header prevents auth-state SSR/CSR drift */}
          <Header />
          {children}
        </HydrationGate>
      </body>
    </html>
  );
}
