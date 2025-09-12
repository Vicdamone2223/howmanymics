import type { Metadata } from 'next';
import './globals.css';
import ClientShell from '@/components/ClientShell'; // <-- normal import (no dynamic)

export const metadata: Metadata = {
  title: 'How Many Mics',
  description: 'Hip-hop rankings, releases, and debates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
